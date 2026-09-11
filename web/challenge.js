import { bindText } from './shared/ui-locale.js';

export function createChallenge(sitekey, onChange = () => {}) {
  const panel = document.getElementById('loginChallenge');
  const widget = document.getElementById('challengeWidget');
  const message = document.getElementById('challengeStatus');
  const retry = document.getElementById('retryChallenge');
  let token = '', id, loading = false;
  panel.hidden = false;
  const state = (text, failed = false) => {
    bindText(message, () => text);
    retry.hidden = !failed;
    panel.classList.toggle('challenge-error', failed);
    onChange();
  };
  const load = async () => {
    if (loading) return;
    loading = true;
    token = '';
    state('正在加载人机验证…');
    try {
      if (!globalThis.turnstile) await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const timer = setTimeout(() => { script.remove(); reject(new Error('timeout')); }, 15000);
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.onload = () => { clearTimeout(timer); resolve(); };
        script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('load')); };
        document.head.append(script);
      });
      if (id !== undefined) turnstile.remove(id);
      state('提交邮箱验证码登录前，请完成人机验证。');
      id = turnstile.render(widget, {
        sitekey, action: 'login', size: 'flexible',
        callback: value => { token = value; state('验证成功，输入邮箱验证码后即可登录。'); },
        'expired-callback': () => { token = ''; state('验证已过期，请重新验证。', true); },
        'error-callback': () => { token = ''; state('人机验证加载失败，请检查网络后重试。', true); },
        'timeout-callback': () => { token = ''; state('验证已超时，请重新验证。', true); },
      });
    } catch {
      state('人机验证加载失败，请检查网络后重试。', true);
    } finally { loading = false; }
  };
  retry.onclick = () => void load();
  void load();
  return {
    token: () => token,
    focus() { panel.scrollIntoView({ block: 'center', behavior: 'smooth' }); panel.focus({ preventScroll: true }); },
    reset() {
      token = '';
      state('再次提交登录前，请重新完成人机验证。');
      if (id !== undefined) turnstile.reset(id);
    },
  };
}
