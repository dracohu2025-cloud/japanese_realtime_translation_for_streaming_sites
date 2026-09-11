import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'parse5';
import { guidePage } from '../scripts/guide-pages.js';
import { sitemapXml, canonicalLocation, llmsTxt } from '../cloud/seo.js';
const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
const all = node => [node, ...(node.childNodes || []).flatMap(all)];

test('指南与 FAQ 静态中英文正文、规范链接、导航与站点地图一致', () => {
  for (const kind of ['how-it-works','faq','subtitle-guide','sample']) for (const locale of ['zh-CN','en']) {
    const html = guidePage(kind,locale), nodes = all(parse(html));
    const path = (locale === 'en' ? '/en/' : '/') + kind;
    const href = (rel,lang) => attr(nodes.find(n=>n.tagName==='link' && attr(n,'rel')===rel && (!lang || attr(n,'hreflang')===lang)), 'href');
    assert.equal(href('canonical'), 'https://kotoba.uk'+path);
    assert.equal(href('alternate','en'), 'https://kotoba.uk/en/'+kind);
    assert.equal(href('alternate','zh-CN'), 'https://kotoba.uk/'+kind);
    assert.match(sitemapXml('https://kotoba.uk'), new RegExp('<loc>https://kotoba.uk'+path+'</loc>'));
    const ids = new Set(nodes.map(n=>attr(n,'id')).filter(Boolean));
    for (const n of nodes.filter(n=>n.tagName==='a')) {
      const target=attr(n,'href');
      if (target.startsWith('#')) assert.ok(ids.has(target.slice(1)), target);
      if (locale==='en' && target.startsWith('/') && !target.startsWith('/downloads')) assert.ok(target.startsWith('/en'),target);
    }
    const visible=nodes.filter(n=>n.nodeName==='#text' && !['script','style','option'].includes(n.parentNode?.tagName) && attr(n.parentNode,'lang') !== 'ja').map(n=>n.value).join(' ');
    if (locale==='en') assert.doesNotMatch(visible,/[\u4e00-\u9fff]/);
    assert.doesNotMatch(html,/missav|porn|jav|adult/i);
    if(kind==='faq'){assert.match(visible,/19\.99/);assert.match(visible,/9\.99/);assert.match(visible,/90/);assert.match(visible,/30/);}
    assert.equal(canonicalLocation('https://kotoba.uk'+path+'/?q=1','https://kotoba.uk'),'https://kotoba.uk'+path+'?q=1');
  }
  assert.match(llmsTxt('https://kotoba.uk'),/\/en\/how-it-works/);
  assert.match(llmsTxt('https://kotoba.uk'),/\/en\/faq/);
});
