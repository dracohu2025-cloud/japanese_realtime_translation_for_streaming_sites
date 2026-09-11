import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { localizedPage } from '../scripts/localized-pages.js';
const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
function nodes(document) {
  return [document, ...(document.childNodes || []).flatMap(nodes)];
}
test('中英文 HTML 不依赖 JavaScript 显示产品、安装、套餐和可互相发现的链接', async () => {
  for (const [file, policy] of [['pricing.html', false], ['policies.html', true]]) {
    const source = await readFile('web/' + file, 'utf8');
    for (const locale of ['zh-CN', 'en']) {
      const html = localizedPage(source, { locale, policy });
      const all = nodes(parse(html));
      const meta = (key) => all.find(n => n.tagName === 'meta' && (attr(n, 'name') === key || attr(n, 'property') === key));
      const link = (rel, lang) => all.find(n => n.tagName === 'link' && attr(n, 'rel') === rel && (!lang || attr(n, 'hreflang') === lang));
      assert.equal(attr(all.find(n=>n.tagName==='html'), 'lang'), locale);
      const path = locale === 'en' ? policy ? '/en/policies.html' : '/en' : policy ? '/policies.html' : '/';
      assert.equal(attr(link('canonical'), 'href'), 'https://kotoba.uk' + path);
      assert.equal(attr(link('alternate', 'en'), 'href'), 'https://kotoba.uk' + (policy ? '/en/policies.html' : '/en'));
      assert.equal(attr(link('alternate', 'zh-CN'), 'href'), 'https://kotoba.uk' + (policy ? '/policies.html' : '/'));
      assert.equal(attr(link('alternate', 'x-default'), 'href'), attr(link('alternate', 'zh-CN'), 'href'));
      assert.equal(attr(meta('og:url'), 'content'), 'https://kotoba.uk' + path);
      assert.equal(attr(meta('og:image'), 'content'), 'https://kotoba.uk/brand/social-card.png');
      assert.equal(attr(meta('twitter:card'), 'content'), 'summary_large_image');
      assert.equal(attr(link('icon'), 'href'), '/favicon.ico');
      const visible = all.filter(n=>n.nodeName==='#text' && !['script','style','option'].includes(n.parentNode?.tagName)).map(n=>n.value).join(' ');
      if (locale === 'en') {
        assert.doesNotMatch(visible, /[\u4e00-\u9fff]/);
        assert.match(visible, /Chrome/);
        assert.match(visible, /19\.99/);
        assert.match(visible, /20 hours/);
        assert.match(visible, /10 hours/);
        assert.match(visible, /90 days/);
        if (policy) assert.match(visible, /support@kotoba.uk/);
      }
      if (!policy) {
        const graph = JSON.parse(all.find(n=>n.tagName==='script' && attr(n,'type')==='application/ld+json').childNodes[0].value);
        const app = graph['@graph'].find(n=>n['@type']==='SoftwareApplication');
        assert.deepEqual(app.offers.map(o=>o.price), ['0.00','19.99','9.99']);
        assert.equal(app.url, 'https://kotoba.uk' + path);
      }
    }
  }
});
test('品牌资源包含多尺寸 favicon 和规定大小的分享图', async () => {
  const ico = await readFile('web/brand/favicon.ico');
  assert.equal(ico.readUInt16LE(2),1); assert.equal(ico.readUInt16LE(4),3);
  assert.deepEqual([ico[6],ico[22],ico[38]], [16,32,48]);
  const png = await readFile('web/brand/social-card.png');
  assert.equal(png.readUInt32BE(16),1200); assert.equal(png.readUInt32BE(20),630);
});

test('宣传片按页面语言预选资源，初始HTML没有视频src或自动播放', async () => {
  const source = await readFile('web/pricing.html', 'utf8');
  for (const locale of ['zh-CN', 'en']) {
    const all = nodes(parse(localizedPage(source, { locale })));
    const video = all.find(n => n.tagName === 'video');
    assert.equal(attr(video, 'src'), undefined);
    assert.equal(attr(video, 'autoplay'), undefined);
    assert.equal(attr(video, 'preload'), 'none');
    assert.match(attr(video, 'data-video'), new RegExp(locale === 'en' ? 'ja-en-v1.mp4$' : 'ja-zh-v1.mp4$'));
    assert.equal(attr(all.find(n => attr(n, 'id') === 'film'), 'open'), undefined);
  }
});
