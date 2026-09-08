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
