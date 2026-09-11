import test from 'node:test';
import assert from 'node:assert/strict';
import { submission, notifyIndexNow } from '../scripts/indexnow.js';
import { discovery } from '../cloud/seo.js';

const key = 'a'.repeat(32), origin = 'https://kotoba.uk';
const env = { PUBLIC_ORIGIN: origin, PAYMENT_MODE: 'live', INDEXNOW_KEY: key };

test('验证文件只在正式环境精确路径开放', () => {
  const url = new URL(`${origin}/${key}.txt`);
  assert.equal(discovery(url, env).body, key);
  assert.equal(discovery(url, { ...env, PAYMENT_MODE: 'test' }), undefined);
  assert.equal(discovery(url, { ...env, INDEXNOW_KEY: undefined }), undefined);
  assert.equal(discovery(new URL(url + '?x=1'), env), undefined);
  assert.equal(discovery(new URL(`${origin}/${'b'.repeat(32)}.txt`), env), undefined);
});

test('通知只允许明确指定的公开规范路径并去重', () => {
  for (const paths of [[], ['/api/account'], ['/en?email=private'], ['/pricing'], ['https://evil.test/'], ['//evil.test/'], ['/en/']]) {
    assert.throws(() => submission(paths, key));
  }
  assert.throws(() => submission(['/en'], 'invalid'));
  assert.deepEqual(submission(['/en', '/en'], key).urlList, [origin + '/en']);
});

function fixture({ invalidKey = false, published = true, noindex = false, canonical = origin + '/en', status = 200 } = {}) {
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, options });
    if (options.method === 'POST') return new Response('', { status });
    if (url === `${origin}/${key}.txt`) return new Response(invalidKey ? 'wrong' : key);
    if (url.endsWith('/sitemap.xml')) return new Response(published ? `<urlset><url><loc>${origin}/en</loc></url></urlset>` : '<urlset/>');
    return new Response(`<html><head><meta name="robots" content="${noindex ? 'noindex' : 'index'}"><link rel="canonical" href="${canonical}"></head></html>`, { headers: { 'Content-Type': 'text/html' } });
  };
  return { calls, request };
}

test('默认只预检；验证失败绝不向搜索引擎提交', async () => {
  const dry = fixture();
  assert.equal((await notifyIndexNow(['/en'], { key, request: dry.request })).submitted, false);
  assert.equal(dry.calls.filter(call => call.options.method === 'POST').length, 0);
  for (const options of [{ invalidKey: true }, { published: false }, { noindex: true }, { canonical: origin + '/' }]) {
    const failed = fixture(options);
    await assert.rejects(notifyIndexNow(['/en'], { key, submit: true, request: failed.request }));
    assert.equal(failed.calls.filter(call => call.options.method === 'POST').length, 0);
  }
});

test('区分 200 与 202，错误无自动重试，回执不泄露验证 key', async () => {
  for (const status of [200, 202, 403, 429]) {
    const fake = fixture({ status });
    const pending = notifyIndexNow(['/en'], { key, submit: true, request: fake.request });
    if (status < 300) {
      const result = await pending;
      assert.equal(result.status, status);
      assert.doesNotMatch(JSON.stringify(result), new RegExp(key));
    } else await assert.rejects(pending, new RegExp(`HTTP ${status}`));
    const posts = fake.calls.filter(call => call.options.method === 'POST');
    assert.equal(posts.length, 1);
    assert.deepEqual(JSON.parse(posts[0].options.body), submission(['/en'], key));
  }
});
