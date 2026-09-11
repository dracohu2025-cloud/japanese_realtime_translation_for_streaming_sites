import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
const target = process.argv.includes('--production') ? 'output/cloud-assets-production' : 'output/cloud-assets';
await mkdir(target, { recursive: true });
for (const file of ['pricing.html', 'pricing.css', 'pricing.js', 'marketing.js', 'account.js', 'acquisition.js', 'challenge.js', 'production-copy.js', 'policies.html', 'guides.css']) {
  await copyFile(`web/${file}`, `${target}/${file}`);
}
await mkdir(`${target}/shared`, { recursive: true });
for (const file of ['messages.js', 'i18n-core.js', 'i18n.js', 'ui-locale.js']) {
  await copyFile(`extension/shared/${file}`, `${target}/shared/${file}`);
}
console.log('线上账户页面已准备；不包含本机配置、数据库和密钥。');

if (process.argv.includes('--production')) {
  const path = target + '/pricing.html';
  let html = await readFile(path, 'utf8');
  const replacements = {
    '内测预览': '现已开放',
    'Stripe 测试模式 · 不产生真实扣款 · 测试额度尚未接入视频翻译': '注册即享 20 分钟试用 · 用完即停 · 不自动转付费',
    '我的测试额度 ↗': '我的时长 ↗',
    'LOCAL TEST ACCOUNT': 'YOUR KOTOBA ACCOUNT',
    '我的测试额度': '我的翻译时长',
    '本机共用一个测试账户。仅验证购买、续订和额度到账；这里的余额不会用于现有插件扣费。': '首次验证邮箱并登录后，20 分钟免费试用自动到账。获取插件连接码，即可开始翻译。',
    '正在连接本机支付测试服务…': '正在读取账户…',
    '测试额度明细': '时长明细',
    '领取测试额度': '领取免费试用',
    '测试月度订阅 ↗': '订阅月度会员 ↗',
    '测试购买加时包 ↗': '购买加时包 ↗',
    '取消测试订阅的自动续订': '取消自动续订',
    '在插件「设置」中填写以下两项，然后开始翻译。此连接扣减当前账户的测试时长。': '在插件中填写连接码和服务地址，即可开始使用当前账户的翻译时长。',
    '以下是付费测试版的拟定规则。<br>实际收款开放前会再次明确展示。': '按音频时长计费，购买前请阅读服务与退款说明。',
    '不能。目前是本机支付测试，使用 Stripe 测试卡，不产生真实扣款。真实账户、云端翻译额度扣减、退款流程及正式收款尚未开放。最终税费与适用条款会在正式付款前展示。': '付款确认后时长自动到账。月度会员自动续订，可随时取消后续续订；加时包不自动续费。',
    '返回本机字幕演示 ↗': '返回首页 ↗',
    'demo@kotoba.test': 'you@example.com',
  };
  for (const [before, after] of Object.entries(replacements)) html = html.replaceAll(before, after);
  await writeFile(path, html);
}

// 静态公开页面共享同一源文、词典与套餐配置。
const { localizedPage } = await import('./localized-pages.js');
const { guidePage } = await import('./guide-pages.js');
const { demoPage } = await import('./demo-page.js');
await writeFile(target + '/demo.html', demoPage('zh-CN'));
await writeFile(target + '/demo.en.html', demoPage('en'));
for (const kind of ['how-it-works', 'faq', 'subtitle-guide', 'sample']) {
  await writeFile(target + '/' + kind + '.html', guidePage(kind, 'zh-CN'));
  await writeFile(target + '/' + kind + '.en.html', guidePage(kind, 'en'));
}
for (const [input, english, policy] of [['pricing.html', 'en.html', false], ['policies.html', 'policies.en.html', true]]) {
  const source = await readFile(target + '/' + input, 'utf8');
  await writeFile(target + '/' + input, localizedPage(source, { locale: 'zh-CN', policy }));
  await writeFile(target + '/' + english, localizedPage(source, { locale: 'en', policy }));
}
await mkdir(target + '/brand', { recursive: true });
for (const file of ['favicon.ico', 'favicon-32.png', 'apple-touch-icon.png', 'social-card.png']) await copyFile('web/brand/' + file, target + '/brand/' + file);

await mkdir(target + "/demo", { recursive: true });
await copyFile("web/demo/japanese-study.wav", target + "/demo/japanese-study.wav");

await mkdir(target + '/marketing', { recursive: true });
for (const file of ['kotoba-ja-zh-v1.mp4', 'kotoba-ja-en-v1.mp4', 'kotoba-zh-v1.jpg', 'kotoba-en-v1.jpg', 'kotoba-real-ja-zh-v1.mp4', 'kotoba-real-ja-zh-v1.jpg']) await copyFile('web/marketing/' + file, target + '/marketing/' + file);
