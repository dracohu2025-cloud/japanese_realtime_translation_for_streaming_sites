export async function createChallenge(sitekey) {
  const container = document.createElement('div');
  container.style.marginTop = '16px';
  document.getElementById('loginForm').append(container);
  await new Promise((resolve, reject) => {
    if (globalThis.turnstile) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.onload = resolve;
    script.onerror = () => reject(new Error('人机验证暂时不可用，请稍后重试。'));
    document.head.append(script);
  });
  let token = '';
  const id = turnstile.render(container, {
    sitekey, action: 'login', size: 'flexible',
    callback: value => { token = value; },
    'expired-callback': () => { token = ''; },
    'error-callback': () => { token = ''; },
  });
  return { token: () => token, reset() { token = ''; turnstile.reset(id); } };
}
