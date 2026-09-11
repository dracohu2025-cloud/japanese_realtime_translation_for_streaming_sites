import test from 'node:test';
import assert from 'node:assert/strict';
import { robotsTxt, sitemapXml, llmsTxt, discovery, canonicalLocation } from '../cloud/seo.js';

const origin = 'https://kotoba.uk';

test('正式环境允许收录并指向站点地图，内测环境禁止索引', () => {
  assert.match(robotsTxt(origin, true), /Allow: \//);
  assert.match(robotsTxt(origin, true), /ai-input=yes/);
  assert.match(robotsTxt(origin, true), /Sitemap: https:\/\/kotoba.uk\/sitemap.xml/);
  assert.match(robotsTxt(origin, false), /Disallow: \//);
  assert.equal(discovery(new URL(origin + '/sitemap.xml'), { PUBLIC_ORIGIN: origin, PAYMENT_MODE: 'test' }).status, 404);
});

test('站点地图只列出可索引页面，说明书可供模型引用且不含站点品牌词', () => {
  const map = sitemapXml(origin);
  assert.match(map, /<loc>https:\/\/kotoba.uk\/<\/loc>/);
  assert.match(map, /<loc>https:\/\/kotoba.uk\/policies.html<\/loc>/);
  assert.doesNotMatch(map, /\/pricing/);
  const llms = llmsTxt(origin);
  assert.match(llms, /Kotoba Live/);
  assert.match(llms, /Chrome extension/);
  assert.match(llms, /tab/);
  assert.doesNotMatch(llms, /missav|jav|porn|adult/i);
  assert.equal(discovery(new URL(origin + '/llms.txt'), { PUBLIC_ORIGIN: origin, PAYMENT_MODE: 'live' }).type, 'text/plain; charset=utf-8');
});

test('http 与 www 归一到正式 https 域名，其它来源不改写', () => {
  assert.equal(canonicalLocation('http://kotoba.uk/', origin), 'https://kotoba.uk/');
  assert.equal(canonicalLocation('http://kotoba.uk/policies.html?x=1', origin), 'https://kotoba.uk/policies.html?x=1');
  assert.equal(canonicalLocation('https://www.kotoba.uk/llms.txt', origin), 'https://kotoba.uk/llms.txt');
  assert.equal(canonicalLocation('https://kotoba.uk/robots.txt', origin), undefined);
  assert.equal(canonicalLocation('https://evil.test/', origin), undefined);
});

test('模型说明书价格与时长符合现行方案，不再发布旧报价', () => {
  const text = llmsTxt(origin);
  assert.match(text, /Monthly: USD 19\.99 for 20 hours/);
  assert.match(text, /Top-up: USD 9\.99 for 10 hours, valid 90 days/);
  assert.match(text, /monthly pass.*USD 19\.99 for 20 hours, valid 30 days/);
  assert.match(text, /Trial: 20 minutes/);
  assert.doesNotMatch(text, /Monthly: USD 9\.99|Top-up: USD 4\.99/);
});

test('英文页面进入 sitemap，训练爬虫与普通搜索爬虫规则分离', () => {
  assert.match(sitemapXml(origin), /<loc>https:\/\/kotoba.uk\/en<\/loc>/);
  assert.match(sitemapXml(origin), /<loc>https:\/\/kotoba.uk\/en\/policies.html<\/loc>/);
  assert.match(robotsTxt(origin, true), /User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: \//);
  assert.match(robotsTxt(origin, true), /User-agent: \*\nAllow: \//);
  assert.match(robotsTxt(origin, true), /Disallow: \/api\//);
  assert.equal(canonicalLocation('https://kotoba.uk/en/?x=1', origin), origin + '/en?x=1');
  assert.equal(canonicalLocation('https://kotoba.uk/policies.en.html', origin), origin + '/en/policies.html');
});
