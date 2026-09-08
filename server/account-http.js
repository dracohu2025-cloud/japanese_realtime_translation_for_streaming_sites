import { fromNodeHeaders } from 'better-auth/node';
import { AppError } from './config.js';

export async function handleAccountHttp(accounts, req, res, path, baseUrl, headers, readBody) {
  if (!path.startsWith('/api/auth/') && !path.startsWith('/api/account')) return false;
  if (req.headers.origin && req.headers.origin !== baseUrl) throw new AppError('FORBIDDEN', '请在账户页面操作', 403);
  if (req.method === 'POST' && req.headers.origin !== baseUrl) throw new AppError('FORBIDDEN', '账户操作需要同源验证', 403);
  if (path.startsWith('/api/auth/')) {
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req, 8192);
    const routes = new Set(['/api/auth/email-otp/send-verification-otp', '/api/auth/sign-in/email-otp', '/api/auth/sign-in/social', '/api/auth/sign-out', '/api/auth/get-session', '/api/auth/callback/google']);
    if (!routes.has(path)) throw new AppError('NOT_FOUND', '登录接口不存在', 404);
    if (body && accounts.developmentInbox) {
      let input;
      try { input = JSON.parse(body.toString()); } catch { throw new AppError('BAD_REQUEST', '登录请求格式错误'); }
      if (typeof input?.email === 'string' && !/^[^@\s]+@[^@\s]+\.test$/i.test(input.email)) throw new AppError('TEST_EMAIL', '本机测试请使用 .test 邮箱');
    }
    const response = await accounts.handleAuth(new Request(new URL(req.url, baseUrl), { method: req.method, headers: fromNodeHeaders(req.headers), body }));
    const outputHeaders = { ...headers };
    for (const [name, value] of response.headers) if (name !== 'set-cookie') outputHeaders[name] = value;
    const cookies = response.headers.getSetCookie();
    if (cookies.length) outputHeaders['Set-Cookie'] = cookies;
    res.writeHead(response.status, outputHeaders); res.end(Buffer.from(await response.arrayBuffer()));
    return true;
  }
  let result;
  if (path === '/api/account' && req.method === 'GET') {
    let user = null;
    try { const value = await accounts.user(req); user = { email: value.email, name: value.name }; }
    catch (error) { if (error.code !== 'LOGIN_REQUIRED') throw error; }
    result = { user, developmentInbox: accounts.developmentInbox, googleEnabled: accounts.googleEnabled };
  } else if (path === '/api/account/connection' && req.method === 'POST') {
    result = { ...await accounts.issueToken(req), relayUrl: baseUrl.replace(/^http/, 'ws') + '/stream' };
  } else if (path === '/api/account/test-code' && req.method === 'GET') {
    result = accounts.readTestCode(new URL(req.url, baseUrl).searchParams.get('email') || '');
  } else throw new AppError('NOT_FOUND', '账户接口不存在', 404);
  res.writeHead(200, { ...headers, 'Content-Type': 'application/json' }); res.end(JSON.stringify(result));
  return true;
}
