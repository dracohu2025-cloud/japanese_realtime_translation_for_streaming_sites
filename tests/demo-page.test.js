import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { parse } from 'parse5';
import { demoPage, demoVideo } from '../scripts/demo-page.js';
import { publicPagePaths, canonicalLocation, llmsTxt } from '../cloud/seo.js';

const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
const all = node => [node, ...(node.childNodes || []).flatMap(all)];

test('实机演示的可见视频、结构化数据、分享图和双语规范网址一致', async () => {
  for (const locale of ['zh-CN', 'en']) {
    const path = locale === 'en' ? '/en/demo' : '/demo';
    const html = demoPage(locale), nodes = all(parse(html));
    const video = nodes.find(n => n.tagName === 'video');
    assert.notEqual(attr(video, 'controls'), undefined);
    assert.equal(attr(video, 'autoplay'), undefined);
    assert.equal(attr(video, 'preload'), 'none');
    assert.equal(attr(video, 'poster'), demoVideo.poster);
    assert.equal(attr(nodes.find(n => n.tagName === 'source'), 'src'), demoVideo.path);
    const schema = JSON.parse(nodes.find(n => n.tagName === 'script' && attr(n, 'type') === 'application/ld+json').childNodes[0].value)['@graph'][0];
    assert.equal(schema['@type'], 'VideoObject');
    assert.equal(schema.contentUrl, 'https://kotoba.uk' + demoVideo.path);
    assert.deepEqual(schema.thumbnailUrl, ['https://kotoba.uk' + demoVideo.poster]);
    assert.deepEqual(schema.inLanguage, ['ja', 'zh-CN']);
    assert.ok(html.includes(schema.transcription));
    assert.equal(attr(nodes.find(n => n.tagName === 'link' && attr(n, 'rel') === 'canonical'), 'href'), 'https://kotoba.uk' + path);
    assert.equal(nodes.filter(n => n.tagName === 'link' && attr(n, 'hreflang')).length, 3);
    assert.equal(attr(nodes.find(n => n.tagName === 'meta' && attr(n, 'property') === 'og:image'), 'content'), schema.thumbnailUrl[0]);
    assert.ok(publicPagePaths.includes(path));
    assert.equal(canonicalLocation('https://kotoba.uk' + path + '/', 'https://kotoba.uk'), 'https://kotoba.uk' + path);
    assert.doesNotMatch(html, /missav|porn|jav|adult/i);
    if (locale === 'en') {
      const visible = nodes.filter(n => n.nodeName === '#text' && !['script', 'style', 'option'].includes(n.parentNode?.tagName) && attr(n.parentNode, 'lang') !== 'ja').map(n => n.value).join(' ');
      assert.doesNotMatch(visible, /[\u4e00-\u9fff]/);
      assert.match(visible, /recording demonstrates Chinese only/);
    }
  }
  for (const asset of [demoVideo.path, demoVideo.poster]) await access('web' + asset);
  assert.match(llmsTxt('https://kotoba.uk'), /\/en\/demo/);
});
