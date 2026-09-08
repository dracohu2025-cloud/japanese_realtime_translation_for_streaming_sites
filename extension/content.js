(() => {
  if (globalThis.__kotobaLive) return;
  globalThis.__kotobaLive = true;
  const i18n = globalThis.KotobaI18n.createTranslator('zh-CN');
  const t = i18n.t;
  let lastStatus = { status: 'connecting' };
  const host = document.createElement('div');
  host.id = 'kotoba-live-captions';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `:host{all:initial;position:fixed!important;inset:auto!important;left:var(--caption-left,5vw)!important;top:var(--caption-top,92vh)!important;width:var(--caption-frame-width,max-content)!important;max-width:var(--caption-width,90vw)!important;transform:translate(-50%,-100%)!important;visibility:var(--caption-visibility,visible)!important;z-index:2147483647!important;pointer-events:none!important;display:block!important;font-family:system-ui,sans-serif!important}*,*::before,*::after{box-sizing:border-box}.panel{margin:auto;max-width:100%;text-align:left;color:#fff;background:rgba(12,21,25,var(--caption-opacity,.9));border-radius:12px;overflow:hidden}.line{width:100%;max-width:100%;margin:0;padding:6px 16px;background:transparent;border-radius:0;line-height:1.5;overflow-wrap:anywhere;white-space:pre-wrap;max-height:4.5em;overflow:hidden}.line:empty{display:none}.original{font-size:17px;color:#d1dfdc}.translation{font-size:28px;font-weight:600}.status{font-size:13px;color:#bfddd5}.partial{opacity:.65}.speaker-run{display:block}.speaker-label{display:inline-block;font-size:clamp(11px,.52em,15px);line-height:1.5;vertical-align:middle;border:1px solid currentColor;border-radius:5px;padding:0 5px;margin-right:8px;font-weight:600}.speaker-note{font-size:11px}.tools{display:flex;justify-content:flex-start;flex-wrap:wrap;gap:4px;margin:0;padding:8px 16px 4px}.tools button{text-align:left;pointer-events:auto;touch-action:none;border:1px solid #ffffff45;border-radius:6px;background:#142822cc;color:#fff;padding:3px 9px;font:12px system-ui;cursor:grab}.tools button:focus-visible{outline:2px solid #9de6bd}.tools .reset,.tools .original-toggle{cursor:pointer}.tools .opacity-control{pointer-events:auto;display:flex;align-items:center;gap:6px;color:#fff;font:12px system-ui;padding:3px 8px;border:1px solid #ffffff45;border-radius:6px;background:#142822cc}.tools .opacity-control input{width:72px;accent-color:#9de6bd}.caption-lanes{min-height:0}.size-bar{display:flex;justify-content:flex-end;flex-shrink:0;padding:3px 6px 8px}.resize-handle{pointer-events:auto;touch-action:none;cursor:nwse-resize;font:12px system-ui;text-align:left;color:#fff;background:#142822dd;border:1px solid #ffffff45;border-radius:6px;padding:4px 8px}.resize-handle:focus-visible{outline:2px solid #9de6bd}.panel.resized{height:var(--caption-frame-height);display:flex;flex-direction:column;background:rgba(12,21,25,var(--caption-opacity,.9));border-radius:12px;outline:1px solid #ffffff40;overflow:hidden}.resized>.tools,.resized>.line{flex-shrink:0}.resized .caption-lanes{display:flex;flex:1;flex-direction:column;gap:6px;overflow:hidden}.resized .caption-lanes .line{flex:1;min-height:0;max-height:none;margin:0;overflow:hidden}`;
  const panel = document.createElement('div'); panel.className = 'panel';
  const original = document.createElement('div'); original.className = 'line original'; original.lang = 'ja';
  const translation = document.createElement('div'); translation.className = 'line translation';
  const status = document.createElement('div'); status.className = 'line status';
  const speakerNote = document.createElement('div'); speakerNote.className = 'line speaker-note';
  const tools = document.createElement('div'); tools.className = 'tools';
  const handle = document.createElement('button'); handle.type = 'button'; handle.textContent = t('⠿ 拖动字幕'); handle.title = t('拖动调整位置，也可用方向键微调');
  const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'reset'; reset.textContent = t('复位');
  const originalToggle = document.createElement('button'); originalToggle.type = 'button'; originalToggle.className = 'original-toggle';
  const opacityControl = document.createElement('label'); opacityControl.className = 'opacity-control'; opacityControl.title = t('字幕背景不透明度');
  const opacityText = document.createElement('span');
  const opacityInput = document.createElement('input'); opacityInput.type = 'range'; opacityInput.min = '0'; opacityInput.max = '100'; opacityInput.value = '90';
  opacityControl.append(opacityText, opacityInput);
  tools.append(handle, reset, originalToggle, opacityControl);
  const lanes = document.createElement('div'); lanes.className = 'caption-lanes'; lanes.append(original, translation);
  const sizeBar = document.createElement('div'); sizeBar.className = 'size-bar';
  const resizeHandle = document.createElement('button'); resizeHandle.type = 'button'; resizeHandle.className = 'resize-handle'; resizeHandle.textContent = t('↘ 拖动调整宽高'); resizeHandle.title = t('拖动右下角调整字幕框大小，字号不变；方向键也可调整'); sizeBar.append(resizeHandle);
  panel.append(tools, speakerNote, lanes, status, sizeBar); shadow.append(style, panel);
  let active = false;
  let showOriginal = true;
  let showSpeakers = true;
  let speakerEpoch = 1;
  let visibleCaptions;
  const speakerColors = ['#9de6c3', '#aaccff', '#ffd18d', '#e4b8ff', '#ffaebd', '#a7e9ef'];
  let lastContent = '';
  let expiry;
  let positionTimer;
  let customPosition;
  let customSize;
  let resizeDrag;
  let drag;
  let bounds;
  let anchor;
  // MissAV 等站点页面上有大量广告/预览 <video>（常静音、自动播放）。
  // 优先选真正的主播放器（Plyr 的 .player / 非静音 / 正在播放的），避免字幕定位到广告上。
  const isAdVideo = video =>
    video.muted ||
    /mn-thumb|thumb|preview|ad-|_ad|ads|banner|promo/i.test((video.className || '') + ' ' + (video.id || '') + ' ' + (video.parentElement?.className || ''));
  const selectedVideo = () => {
    const visible = [...document.querySelectorAll('video')]
      .filter(video => video.clientWidth > 0 && video.clientHeight > 0);
    if (!visible.length) return undefined;
    // 1) 优先：Plyr 主播放器里的 video
    const plyr = visible.filter(v => v.closest('.plyr, .plyr__video-wrapper') || v.classList.contains('player'));
    // 2) 其次：非广告视频
    const main = plyr.length ? plyr : visible.filter(v => !isAdVideo(v));
    const pool = main.length ? main : visible;
    // 3) 同尺寸优先选正在播放且非静音的
    return pool.sort((a, b) => {
      const scoreA = (a.paused ? 0 : 2) + (a.muted ? 0 : 1);
      const scoreB = (b.paused ? 0 : 2) + (b.muted ? 0 : 1);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight;
    })[0];
  };
  const selectedMedia = () => selectedVideo() || document.querySelector('audio');
  function position() {
    if (!active) return;
    const parent = document.fullscreenElement || document.documentElement;
    if (host.parentNode !== parent) parent.append(host);
    const video = selectedVideo();
    const rect = video?.getBoundingClientRect();
    // 默认跟随视频，手动位置则使用整个页面视口坐标，不随播放器滚动。
    bounds = { left: 0, top: 0, width: innerWidth, height: innerHeight };
    const width = Math.max(1, Math.min(innerWidth - 16, customSize ? customSize.width : Math.min(920, rect ? rect.width * .9 : innerWidth * .9)));
    panel.className = customSize ? 'panel resized' : 'panel';
    host.style.setProperty('--caption-frame-width', customSize ? `${width}px` : 'max-content');
    host.style.setProperty('--caption-frame-height', customSize ? `${Math.min(customSize.height, Math.max(1, innerHeight - 16))}px` : 'auto');
    host.style.setProperty('--caption-width', `${width}px`);
    // 按完整文字行分配高度，避免缩放后边缘只露出半行字幕。
    const available = (lanes.getBoundingClientRect().height - (showOriginal ? 6 : 0)) / (showOriginal ? 2 : 1);
    for (const [element, font] of [[original, 17], [translation, Number.parseFloat(translation.style.fontSize) || 28]]) {
      const lineHeight = font * 1.5;
      const laneHeight = Math.max(0, Math.floor((available - 12) / lineHeight)) * lineHeight + 12;
      element.style.flex = customSize ? `0 0 ${laneHeight}px` : '';
    }
    const desired = customPosition || {
      x: rect ? (rect.left + rect.width / 2) / innerWidth : .5,
      y: rect ? (rect.bottom - Math.min(rect.height * .25, Math.max(48, rect.height * .08))) / innerHeight : .92,
    };
    const half = Math.min(host.getBoundingClientRect().width || width, width) / 2;
    const height = Math.min(host.getBoundingClientRect().height || 40, innerHeight);
    anchor = { x: Math.max(half, Math.min(innerWidth - half, desired.x * innerWidth)), y: Math.max(height, Math.min(innerHeight, desired.y * innerHeight)) };
    const visible = customPosition || !rect || (rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth);
    host.style.setProperty('--caption-left', `${anchor.x}px`);
    host.style.setProperty('--caption-top', `${anchor.y}px`);
    host.style.setProperty('--caption-visibility', visible ? 'visible' : 'hidden');
    // 尺寸改变后重新贴近最新字幕，不缩放文字。
    original.scrollTop = original.scrollHeight; translation.scrollTop = translation.scrollHeight;
  }
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !bounds) return;
    event.preventDefault(); event.stopPropagation();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, anchor: { ...anchor } };
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    event.preventDefault(); event.stopPropagation();
    customPosition = { x: (drag.anchor.x + event.clientX - drag.x) / bounds.width, y: (drag.anchor.y + event.clientY - drag.y) / bounds.height };
    position();
    customPosition = { x: anchor.x / bounds.width, y: anchor.y / bounds.height };
  });
  const endDrag = () => { drag = null; };
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
  handle.addEventListener('lostpointercapture', endDrag);
  handle.addEventListener('keydown', event => {
    const delta = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[event.key];
    if (!delta || !bounds) return;
    event.preventDefault(); event.stopPropagation();
    customPosition = { x: (anchor.x + delta[0]) / bounds.width, y: (anchor.y + delta[1]) / bounds.height };
    position();
  });
  reset.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); customPosition = null; customSize = null; position(); });
  function resizeTo(width, height, left, top) {
    const maxWidth = Math.max(1, innerWidth - Math.max(0, left));
    const maxHeight = Math.max(1, innerHeight - Math.max(0, top));
    customSize = { width: Math.max(Math.min(280, maxWidth), Math.min(maxWidth, width)), height: Math.max(Math.min(260, maxHeight), Math.min(maxHeight, height)) };
    customPosition = { x: (left + customSize.width / 2) / innerWidth, y: (top + customSize.height) / innerHeight };
    position();
  }
  resizeHandle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !active) return;
    event.preventDefault(); event.stopPropagation();
    resizeDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, rect: host.getBoundingClientRect() };
    resizeHandle.setPointerCapture(event.pointerId);
  });
  resizeHandle.addEventListener('pointermove', event => {
    if (!resizeDrag || event.pointerId !== resizeDrag.id) return;
    event.preventDefault(); event.stopPropagation();
    const { rect, x, y } = resizeDrag;
    resizeTo(rect.width + event.clientX - x, rect.height + event.clientY - y, rect.left, rect.top);
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) resizeHandle.addEventListener(event, () => { resizeDrag = null; });
  resizeHandle.addEventListener('keydown', event => {
    const delta = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }[event.key];
    if (!delta || !active) return;
    event.preventDefault(); event.stopPropagation();
    const rect = host.getBoundingClientRect();
    resizeTo(rect.width + delta[0], rect.height + delta[1], rect.left, rect.top);
  });
  function setOpacity(value) {
    const opacity = Math.max(0, Math.min(100, (Number.isFinite(Number(value)) ? Number(value) : 90)));
    host.style.setProperty('--caption-opacity', opacity / 100);
    opacityInput.value = String(opacity);
    opacityText.textContent = t('背景 {percent}', { percent: i18n.percent(opacity) });
  }
  opacityInput.addEventListener('input', () => setOpacity(opacityInput.value));
  opacityInput.addEventListener('change', async () => {
    const result = await chrome.runtime.sendMessage({ type: 'SET_OPACITY', opacity: Number(opacityInput.value) });
    if (!result?.ok) status.textContent = t(result?.error || '未能更新不透明度');
  });
  function setOriginal(value) {
    showOriginal = value;
    original.style.display = value ? '' : 'none';
    originalToggle.textContent = t(value ? '隐藏日文原文' : '显示日文原文');
    position();
  }
  originalToggle.addEventListener('click', async event => {
    event.preventDefault(); event.stopPropagation();
    originalToggle.disabled = true;
    try {
      const value = !showOriginal;
      const result = await chrome.runtime.sendMessage({ type: 'SET_ORIGINAL', showOriginal: value });
      if (!result?.ok) throw new Error(result?.error || '未能更新显示设置');
      setOriginal(value);
    } catch (error) { status.textContent = t(error.message); }
    finally { originalToggle.disabled = false; }
  });
  function paint(element, lane) {
    if (showSpeakers && lane?.runs?.length) {
      const rows = lane.runs.map(run => {
        const row = document.createElement('span'); row.className = 'speaker-run';
        if (/^(?:[1-9]|1[0-5])$/.test(run.speaker || '')) {
          const label = document.createElement('span'); label.className = 'speaker-label';
          label.textContent = t(speakerEpoch > 1 ? '{epoch}段 · 说话人 {speaker}' : '说话人 {speaker}', { epoch: i18n.number(speakerEpoch), speaker: run.speaker });
          label.lang = i18n.getLocale();
          label.style.color = speakerColors[(Number(run.speaker) - 1) % speakerColors.length];
          label.title = t('当前连接内的声音编号，不代表角色身份');
          row.append(label);
        }
        const partial = document.createElement('span'); partial.className = 'partial'; partial.textContent = run.partial || '';
        row.append(document.createTextNode(run.final || ''), partial);
        return row;
      });
      element.replaceChildren(...rows);
    } else {
      const final = document.createTextNode(lane?.final || '');
      const partial = document.createElement('span'); partial.className = 'partial'; partial.textContent = lane?.partial || '';
      element.replaceChildren(final, partial);
    }
    element.scrollTop = element.scrollHeight;
  }
  function renderSpeakers() {
    speakerNote.textContent = showSpeakers && speakerEpoch > 1 ? t('第 {epoch} 段连接 · 说话人编号已重置', { epoch: i18n.number(speakerEpoch) }) : '';
    if (visibleCaptions) { paint(original, visibleCaptions.original); paint(translation, visibleCaptions.translation); }
    position();
  }
  function renderStatus() {
    status.textContent = t(lastStatus.status === 'error' ? lastStatus.message : lastStatus.status === 'paused' ? '已暂停 · 恢复播放后继续' : lastStatus.status === 'connecting' ? '正在连接日语字幕…' : '');
  }
  function localizeControls() {
    panel.lang = i18n.getLocale();
    handle.textContent = t('⠿ 拖动字幕'); handle.title = t('拖动调整位置，也可用方向键微调');
    reset.textContent = t('复位');
    opacityControl.title = t('字幕背景不透明度');
    resizeHandle.textContent = t('↘ 拖动调整宽高'); resizeHandle.title = t('拖动右下角调整字幕框大小，字号不变；方向键也可调整');
    setOriginal(showOriginal); setOpacity(opacityInput.value); renderStatus();
  }
  chrome.runtime.onMessage.addListener(message => {
    if (message.type === 'KOTOBA_CONFIG') {
      i18n.setLocale(message.settings.uiLocale || 'zh-CN');
      translation.lang = message.settings.targetLanguage || 'zh';
      lastStatus = { status: 'connecting' }; localizeControls();
      speakerEpoch = 1; showSpeakers = message.settings.showSpeakers !== false;
      active = true; renderSpeakers(); position(); status.textContent = t('正在连接日语字幕…');
      clearInterval(positionTimer);
      positionTimer = setInterval(position, 200);
      setOriginal(message.settings.showOriginal);
      translation.style.fontSize = `${Math.max(18, Math.min(42, Number(message.settings.fontSize) || 28))}px`;
      setOpacity(message.settings.opacity);
    } else if (message.type === 'KOTOBA_SETTINGS') {
      if (message.settings.targetLanguage) translation.lang = message.settings.targetLanguage;
      if (message.settings.uiLocale) { i18n.setLocale(message.settings.uiLocale); localizeControls(); }
      if (typeof message.settings.showOriginal === 'boolean') setOriginal(message.settings.showOriginal);
      if (typeof message.settings.showSpeakers === 'boolean') showSpeakers = message.settings.showSpeakers;
      if (message.settings.opacity !== undefined) setOpacity(message.settings.opacity);
      renderSpeakers();
    } else if (message.type === 'KOTOBA_CAPTIONS' && active) {
      const next = JSON.stringify(message.captions);
      if (next === lastContent) return;
      visibleCaptions = message.captions;
      if (Number.isInteger(message.captions.speakerEpoch) && message.captions.speakerEpoch > 0) speakerEpoch = message.captions.speakerEpoch;
      renderSpeakers();
      clearTimeout(expiry); lastContent = next;
      expiry = setTimeout(() => { if (customSize) return; visibleCaptions = null; original.textContent = ''; translation.textContent = ''; }, 9000);
    } else if (message.type === 'KOTOBA_STATUS' && active) {
      if (Number.isInteger(message.speakerEpoch) && message.speakerEpoch >= speakerEpoch) {
        if (message.speakerEpoch > speakerEpoch) { visibleCaptions = null; original.textContent = ''; translation.textContent = ''; }
        speakerEpoch = message.speakerEpoch; renderSpeakers();
      }
      lastStatus = message; renderStatus();
    } else if (message.type === 'KOTOBA_REMOVE') {
      active = false; visibleCaptions = null; speakerNote.textContent = ''; clearTimeout(expiry); clearInterval(positionTimer); host.remove(); original.textContent = ''; translation.textContent = ''; lastContent = '';
    }
  });
  document.addEventListener('fullscreenchange', position);
  document.addEventListener('scroll', position, true);
  globalThis.addEventListener('resize', position);
  for (const event of ['pause', 'playing', 'seeking', 'seeked', 'ended']) {
    document.addEventListener(event, e => {
      if (!active || e.target !== selectedMedia()) return;
      const type = event === 'seeking' ? 'seek' : event === 'playing' || (event === 'seeked' && !e.target.paused) ? 'resume' : 'pause';
      chrome.runtime.sendMessage({ type: 'MEDIA_EVENT', event: type }).catch(() => {});
    }, true);
  }
})();
