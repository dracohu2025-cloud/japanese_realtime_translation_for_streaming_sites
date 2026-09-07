import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  app, BrowserWindow, BrowserView, ipcMain, desktopCapturer, session as electronSession,
} from 'electron';
import { loadConfig } from '../server/config.js';
import { TranslateSession } from './translate-session.js';
import { applyBrowserStealth, buildChromeUa } from './stealth.js';
import {
  createCdnProxy, buildCdnProxyInject, attachCdnProtocol, registerCdnScheme,
} from './cdn-proxy.js';
import { matchMissav, buildMissavKeepPlayScript } from './sites/missav.js';

// 必须在 ready 前：隐藏 navigator.webdriver 等自动化标记。
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
// 流媒体站常在用户点播放后异步拉流，放宽自动播放限制。
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// MissAV CDN 走特权协议，避免 https→http 混合内容拦截。
registerCdnScheme();

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const BROWSER_PARTITION = 'persist:kotoba-browser-v3';

function applyEnvFile(filePath) {
  if (!existsSync(filePath)) return false;
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === '') process.env[key] = value;
  }
  return true;
}

function envCandidates() {
  const list = [
    join(process.cwd(), '.env'),
    join(root, '.env'),
  ];
  try {
    list.unshift(join(app.getPath('userData'), '.env'));
  } catch { /* ignore */ }
  try {
    if (app.isPackaged) {
      const besideApp = resolve(dirname(process.execPath), '..', '..', '..');
      list.unshift(join(besideApp, '.env'), join(besideApp, 'kotoba-live.env'));
      list.unshift(join(besideApp, 'mac-arm64', '.env'));
    }
  } catch { /* ignore */ }
  return [...new Set(list)];
}

function loadEnvFiles() {
  const loaded = [];
  for (const filePath of envCandidates()) {
    if (applyEnvFile(filePath)) loaded.push(filePath);
  }
  return loaded;
}

const TOOLBAR = 52;
const STATUSBAR = 36;
const HOME = 'https://www.youtube.com';

let mainWindow;
let contentView;
let overlayWindow;
let translate;
let config;
let envLoadedFrom = [];
let chromeUa = buildChromeUa(process.versions.chrome);
let cdnProxy;

function contentBounds() {
  if (!mainWindow) return null;
  const [width, height] = mainWindow.getContentSize();
  return {
    x: 0,
    y: TOOLBAR,
    width,
    height: Math.max(100, height - TOOLBAR - STATUSBAR),
  };
}

function layout() {
  if (!mainWindow || !contentView) return;
  const bounds = contentBounds();
  contentView.setBounds(bounds);
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    const content = mainWindow.getContentBounds();
    overlayWindow.setBounds({
      x: Math.round(content.x + bounds.x),
      y: Math.round(content.y + bounds.y),
      width: bounds.width,
      height: bounds.height,
    });
  }
}

function sendShell(channel, payload) {
  mainWindow?.webContents.send(channel, payload);
}

function sendOverlay(channel, payload) {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send(channel, payload);
}

function normalizeUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return HOME;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[\w.-]+\.[a-z]{2,}([/:].*)?$/i.test(raw)) return `https://${raw}`;
  return `https://www.google.com/search?q=${encodeURIComponent(raw)}`;
}

function createTranslate() {
  translate = new TranslateSession({
    apiKey: config.apiKey,
    model: config.model,
    maxSessionMs: config.maxSessionMs,
    onEvent(event) {
      if (event.type === 'captions') {
        showOverlay();
        sendShell('translate:captions', event.captions);
        sendOverlay('translate:captions', event.captions);
      } else if (event.type === 'status') {
        if (event.status === 'connecting' || event.status === 'listening') showOverlay();
        if (event.status === 'idle' || event.status === 'error') hideOverlay();
        sendShell('translate:status', event);
        sendOverlay('translate:status', event);
      } else if (event.type === 'meter') {
        sendShell('translate:meter', event);
      }
    },
  });
}

function showOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  layout();
  if (!overlayWindow.isVisible()) overlayWindow.showInactive();
}

function hideOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  overlayWindow.hide();
}

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    parent: mainWindow,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    hasShadow: false,
    skipTaskbar: true,
    show: false,
    fullscreenable: false,
    roundedCorners: false,
    webPreferences: {
      preload: join(__dirname, 'preload-overlay.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.webContents.setAudioMuted(true);
  overlayWindow.loadFile(join(__dirname, 'overlay/index.html'));
  // 默认不显示：避免叠层窗口抢焦点，触发站点 blur→pause。
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'Kotoba Live',
    backgroundColor: '#0c1519',
    webPreferences: {
      preload: join(__dirname, 'preload-shell.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  contentView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: BROWSER_PARTITION,
      // MissAV 正片需经本机 http 代理；https 页默认会拦截混合内容。
      webSecurity: false,
      backgroundThrottling: false,
    },
  });
  contentView.webContents.setUserAgent(chromeUa);

  mainWindow.setBrowserView(contentView);
  layout();
  createOverlayWindow();

  mainWindow.on('resize', layout);
  mainWindow.on('move', layout);
  mainWindow.on('closed', () => {
    translate?.stop('user');
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.destroy();
    mainWindow = null;
    contentView = null;
    overlayWindow = null;
  });

  contentView.webContents.on('did-navigate', (_e, url) => sendShell('browser:url', url));
  contentView.webContents.on('did-navigate-in-page', (_e, url) => sendShell('browser:url', url));
  contentView.webContents.on('dom-ready', () => {
    const url = contentView.webContents.getURL();
    if (!matchMissav(url)) return;
    contentView.webContents.executeJavaScript(buildMissavKeepPlayScript()).catch(() => {});
  });
  contentView.webContents.on('page-title-updated', (_e, title) => {
    if (mainWindow) mainWindow.setTitle(`${title} · Kotoba Live`);
  });
  contentView.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    sendShell('translate:status', {
      status: 'error',
      message: `页面加载失败(${code}) ${desc || ''} ${url || ''}`.trim(),
    });
  });
  // 许多流媒体站用 window.open 弹广告页作为播放解锁条件；必须 allow，
  // 不能 deny 后再手开，否则页面拿到的是 null，会认为弹窗被拦截。
  contentView.webContents.setWindowOpenHandler(() => ({
    action: 'allow',
    overrideBrowserWindowOptions: {
      width: 1024,
      height: 768,
      autoHideMenuBar: true,
      webPreferences: {
        partition: BROWSER_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    },
  }));
  contentView.webContents.on('did-create-window', (child) => {
    child.webContents.setUserAgent(chromeUa);
    // 广告弹窗打开后主窗口会 blur，MissAV 会 pause；稍后把焦点拉回主窗口并提示继续播。
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus();
      contentView?.webContents.executeJavaScript(`
        (() => {
          try {
            if (window.player && !window.player.playing) {
              const p = window.player.play();
              if (p && p.catch) p.catch(() => {});
            }
            if (window.hls && window.hls.startLoad) window.hls.startLoad(-1);
          } catch {}
        })();
      `).catch(() => {});
    }, 400);
    child.webContents.setWindowOpenHandler(() => ({
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 1024,
        height: 768,
        autoHideMenuBar: true,
        webPreferences: {
          partition: BROWSER_PARTITION,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      },
    }));
  });

  mainWindow.loadFile(join(__dirname, 'shell/index.html'));
  contentView.webContents.loadURL(HOME);
}

function registerIpc() {
  ipcMain.handle('app:ready-state', () => ({
    ready: Boolean(config.apiKey),
    model: config.model,
    home: HOME,
    envFiles: envLoadedFrom,
    proxy: cdnProxy?.stats || null,
    envHint: config.apiKey
      ? ''
      : `未读到 SONIOX_API_KEY。可将 .env 放到：${join(app.getPath('userData'), '.env')}`,
  }));

  ipcMain.handle('browser:navigate', (_e, url) => {
    const target = normalizeUrl(url);
    contentView?.webContents.loadURL(target);
    return target;
  });

  ipcMain.handle('browser:back', () => {
    if (contentView?.webContents.navigationHistory?.canGoBack()) contentView.webContents.navigationHistory.goBack();
    else if (contentView?.webContents.canGoBack()) contentView.webContents.goBack();
  });

  ipcMain.handle('browser:forward', () => {
    if (contentView?.webContents.navigationHistory?.canGoForward()) contentView.webContents.navigationHistory.goForward();
    else if (contentView?.webContents.canGoForward()) contentView.webContents.goForward();
  });

  ipcMain.handle('browser:reload', () => contentView?.webContents.reload());

  ipcMain.handle('browser:current-url', () => contentView?.webContents.getURL() || '');

  ipcMain.handle('capture:window-source', async () => {
    if (!mainWindow) throw new Error('窗口未就绪');
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 0, height: 0 },
    });
    const mediaId = mainWindow.getMediaSourceId();
    const match = sources.find(source => source.id === mediaId)
      || sources.find(source => source.name.includes('Kotoba Live'));
    if (!match) throw new Error('找不到本窗口音视频源，请确认已授予屏幕录制权限');
    return { id: match.id, name: match.name };
  });

  ipcMain.handle('translate:start', async (_e, options = {}) => {
    envLoadedFrom = loadEnvFiles();
    config = loadConfig(process.env);
    createTranslate();
    await translate.start({
      targetLanguage: 'zh',
      context: String(options.context || '').slice(0, 1000),
      terms: String(options.terms || '')
        .split(/[,，\n]/)
        .map(x => x.trim())
        .filter(Boolean)
        .slice(0, 30),
    });
    return { ok: true };
  });

  ipcMain.on('translate:pcm', (_e, buffer) => {
    translate?.writePcm(buffer);
  });

  ipcMain.handle('translate:stop', () => {
    translate?.stop('user');
    return { ok: true };
  });
}

app.whenReady().then(async () => {
  const chromeVersion = process.versions.chrome;
  chromeUa = buildChromeUa(chromeVersion);
  app.userAgentFallback = chromeUa;

  cdnProxy = createCdnProxy();
  const proxyPort = await cdnProxy.listen(8791);

  const browserSession = electronSession.fromPartition(BROWSER_PARTITION);
  attachCdnProtocol(browserSession);
  applyBrowserStealth(browserSession, {
    userDataDir: app.getPath('userData'),
    chromeVersion,
    extraFullScripts: [buildCdnProxyInject(proxyPort)],
  });
  process.stdout.write(JSON.stringify({ event: 'cdn_proxy_ready', ...cdnProxy.stats }) + '\n');

  envLoadedFrom = loadEnvFiles();
  config = loadConfig(process.env);
  electronSession.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(['media', 'display-capture', 'mediaKeySystem'].includes(permission));
  });
  browserSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(true);
  });
  registerIpc();
  createWindow();
});

app.on('window-all-closed', async () => {
  translate?.stop('user');
  await cdnProxy?.close?.();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
