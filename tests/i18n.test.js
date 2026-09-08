import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTranslator, resolveLocale, messages } from '../extension/shared/i18n.js';

test('界面语言遵循手动选择、浏览器偏好和英文回退，金额始终使用 USD', () => {
  assert.equal(resolveLocale('en', ['zh-CN']), 'en');
  assert.equal(resolveLocale('zh-CN', ['en-US']), 'zh-CN');
  assert.equal(resolveLocale('auto', ['fr', 'zh-TW', 'en-US']), 'zh-CN');
  assert.equal(resolveLocale('auto', ['en-GB', 'zh-CN']), 'en');
  assert.equal(resolveLocale('invalid', ['ja-JP']), 'en');
  const ui = createTranslator('en');
  assert.equal(ui.t('显示日文原文'), 'Show Japanese text');
  assert.equal(ui.duration(1), '1 second');
  assert.equal(ui.duration(3661), '1 hour 1 minute 1 second');
  assert.equal(ui.duration(0), '0 seconds');
  assert.match(ui.money(999), /USD.*9\.99/);
  assert.equal(ui.percent(0), '0%');
  assert.equal(ui.t('本次 {duration}', {duration:'01:15'}), 'Session 01:15');
  ui.setLocale('zh-CN');
  assert.equal(ui.t('显示日文原文'), '显示日文原文');
  assert.match(ui.duration(1), /1.*秒/);
  assert.match(ui.money(999), /USD.*9\.99/);
  assert.equal(ui.t('未知键'), '未知键');
});

test('英文资源保留全部命名参数，三处用户页面的静态中文均有翻译', async () => {
  const params = value => [...value.matchAll(/\{(\w+)\}/g)].map(x => x[1]).sort();
  for (const [source, translated] of Object.entries(messages)) {
    assert(translated.length, source);
    assert.deepEqual(params(translated), params(source), source);
  }
  for (const file of ['extension/popup.html','extension/options.html','web/pricing.html']) {
    const html = await readFile(file,'utf8');
    const text = [...html.matchAll(/>([^<>]+)</g), ...html.matchAll(/(?:title|aria-label|placeholder|content)="([^"]+)"/g)];
    for (const [, raw] of text) {
      const key = raw.trim();
      if (/[\p{Script=Han}]/u.test(key) && key !== '简体中文' && !key.startsWith('ことば')) assert(Object.hasOwn(messages,key), `${file}: ${key}`);
    }
  }
});

test('扩展原生名称和说明的中英文资源与 manifest 对应', async () => {
  const manifest = JSON.parse(await readFile('extension/manifest.json'));
  assert.equal(manifest.default_locale, 'en');
  for (const locale of ['en','zh_CN']) {
    const resources = JSON.parse(await readFile(`extension/_locales/${locale}/messages.json`));
    for (const value of [manifest.name,manifest.description,manifest.action.default_title]) assert(resources[value.match(/^__MSG_(.+)__$/)[1]].message);
  }
});
