import { localizedPage } from './localized-pages.js';

export const demoVideo = {
  path: '/marketing/kotoba-real-ja-zh-v1.mp4',
  poster: '/marketing/kotoba-real-ja-zh-v1.jpg',
  duration: 'PT32S',
  published: '2026-09-11T03:26:19+00:00',
};

const script = '今日は、外国語の勉強について話します。毎日十分でも、好きな内容を聞き続けることが大切です。分からない言葉があったら、一度止めて、もう一度聞いてみましょう。';
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');

// 两种页面语言使用同一段真实日译中录屏，不把英文说明包装成英文字幕实测。
export function demoPage(locale) {
  const en = locale === 'en', base = en ? '/en' : '';
  const c = en ? {
    title: 'Japanese to Chinese subtitles: a real Chrome demo',
    description: 'Watch Kotoba Live turn Japanese tab audio into Chinese subtitles in a 32-second Chrome recording. See the original audio, actual captions, and setup steps.',
    eyebrow: '32 SECONDS · REAL CHROME RECORDING',
    intro: 'Press play to see Kotoba capture Japanese audio and display Chinese captions in a real Chrome tab.',
    note: 'Japanese audio · Chinese captions and interface · Original synthetic speech',
    evidence: 'The middle section is a continuous recording of Chrome, the installed extension, and actual cloud translation. Speech and caption timing are preserved. The opening, closing, and step labels are edited. This is one clean synthetic-audio example, not a general accuracy or latency benchmark.',
    chapters: 'What happens in the video',
    scenes: [
      ['00:00–00:03', 'Meet Kotoba Live', 'The opening introduces the idea: keep the Japanese audio and read the translation.'],
      ['00:03–00:10', 'Start translation in Chrome', 'The extension is set to Chinese and translation is started on the original listening page.'],
      ['00:10–00:21', 'Listen as captions arrive', 'Japanese audio plays while the extension receives and displays translation text.'],
      ['00:21–00:28', 'Read the actual Chinese output', 'The recording shows the generated Chinese captions, including their wording and delay.'],
      ['00:28–00:32', 'Try your own listening material', 'The closing introduces the one-time 20-minute free trial. No card is required.'],
    ],
    source: 'The Japanese spoken in this recording',
    sourceNote: 'This is our original script, read by a synthetic voice. It is not an excerpt from a film, a course, or a third-party video.',
    meaningTitle: 'English reading reference',
    meaning: 'Today we will talk about studying foreign languages. Even ten minutes a day of listening to something you enjoy matters. If you encounter a word you do not understand, pause and listen again.',
    meaningNote: 'This reference explains the Japanese script; it is not English output from the extension in this recording.',
    next: 'Try it with the Japanese you want to understand',
    steps: 'Install Kotoba in desktop Chrome, verify your email, and connect the extension from your account page. Your first verified sign-in automatically adds 20 free minutes. Start playback in a Japanese-audio tab, then start translation.',
    install: 'Install from Chrome Web Store ↗', manual: 'Manual installation guide',
    how: 'Setup & account connection', sample: 'Listen to the source and compare sample outputs', faq: 'Help & FAQ', home: 'Home', language: 'Interface language', signIn: 'Sign in / Try free', privacy: 'Terms & privacy',
    limits: 'What this demo does and does not show',
    limitsText: 'The product supports English and Simplified Chinese target captions, but this recording demonstrates Chinese only. It produces text captions, not translated speech. Real-world noise, overlapping speakers, accents, and network conditions can affect the result. Test your own player and content during the trial.',
  } : {
    title: '日语原声，中文字幕：Chrome 实机演示',
    description: '观看 32 秒 Kotoba Live 实机录屏：在 Chrome 中采集日语原声，实时生成中文字幕。附原始日语文稿、操作说明与安装连接指南。',
    eyebrow: '32 秒 · CHROME 实机录屏',
    intro: '点击播放，看看一段日语如何在真实 Chrome 标签页中变成中文字幕。',
    note: '日语原声 · 中文字幕与界面 · 原创合成语音',
    evidence: '中间部分连续录制真实 Chrome、已安装的插件和实际云端翻译，保留原声与字幕生成的时间关系。片头、片尾和步骤说明经过剪辑。这是一个干净合成语音样本，不代表整体准确率或普遍延迟。',
    chapters: '视频里发生了什么',
    scenes: [
      ['00:00–00:03', '认识 Kotoba Live', '保留日语原声，在眼前阅读译文。'],
      ['00:03–00:10', '在 Chrome 中开启翻译', '插件选择中文，在原创听力页面上开始翻译。'],
      ['00:10–00:21', '边听日语，边等待字幕出现', '日语音频播放，插件接收并显示翻译文字。'],
      ['00:21–00:28', '查看实际生成的中文字幕', '保留本次识别与翻译的实际措辞，以及字幕出现的等待过程。'],
      ['00:28–00:32', '尝试自己想听懂的内容', '片尾介绍一次性 20 分钟免费试用，无需银行卡。'],
    ],
    source: '录屏中的日语原文',
    sourceNote: '这是我们创作的文稿，由合成语音朗读，没有使用第三方影视、课程或视频片段。',
    meaningTitle: '中文阅读参考',
    meaning: '今天聊聊外语学习。即使每天只有十分钟，坚持听自己感兴趣的内容也很重要。遇到不懂的词，可以暂停一下，再听一遍。',
    meaningNote: '以上是帮助理解原文的阅读参考；插件当次实际输出以录屏中显示的字幕为准。',
    next: '从你想听懂的日语开始',
    steps: '在电脑端 Chrome 安装 Kotoba，验证邮箱并登录，首次登录自动到账 20 分钟免费试用。在账户页获取连接码并连接插件，然后播放日语内容、开启翻译即可。',
    install: '从 Chrome 商店安装 ↗', manual: '手动安装指南',
    how: '安装与账户连接步骤', sample: '试听原声与查看样本输出', faq: '帮助与常见问题', home: '首页', language: '界面语言', signIn: '登录 / 免费试用', privacy: '服务与隐私',
    limits: '这段演示展示了什么',
    limitsText: '产品支持英文和简体中文字幕，本片演示的是日语到中文。当前提供文字字幕，不提供翻译配音。噪声、多人同时说话、口音和网络情况都会影响效果，请在试用期间用你实际观看的播放器和内容验证。',
  };
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': [{
    '@type': 'VideoObject', '@id': 'https://kotoba.uk' + base + '/demo#video',
    name: c.title, description: c.description, thumbnailUrl: ['https://kotoba.uk' + demoVideo.poster],
    uploadDate: demoVideo.published, duration: demoVideo.duration,
    contentUrl: 'https://kotoba.uk' + demoVideo.path, inLanguage: ['ja', 'zh-CN'],
    transcription: script, publisher: { '@type': 'Organization', name: 'DracoNova Inc', url: 'https://kotoba.uk/' },
  }] }).replaceAll('<', '\\u003c');
  return localizedPage(`<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(c.title)} · Kotoba Live</title><meta name="description" content="${escape(c.description)}"><link rel="canonical" href="https://kotoba.uk/demo"><meta property="og:type" content="website"><meta property="og:title" content="${escape(c.title)}"><meta property="og:description" content="${escape(c.description)}"><meta property="og:url" content="https://kotoba.uk/demo"><link rel="stylesheet" href="/pricing.css"><link rel="stylesheet" href="/guides.css"><script type="application/ld+json">${json}</script></head><body><header><a class="brand" href="${base || '/'}">Kotoba Live</a><nav aria-label="${c.home}"><a href="${base}/how-it-works">${c.how}</a><a href="${base}/faq">${c.faq}</a></nav><div class="header-actions"><select data-ui-language aria-label="${c.language}"><option value="zh-CN">简体中文</option><option value="en">English</option></select><a class="account-entry" href="${base || '/'}#loginPanel">${c.signIn}</a></div></header><main class="guide-page demo-page"><p class="eyebrow">${c.eyebrow}</p><h1>${c.title}</h1><p class="guide-intro">${c.intro}</p><figure class="demo-player"><video controls playsinline preload="none" width="1920" height="1080" poster="${demoVideo.poster}" aria-label="${c.title}" aria-describedby="demoNote"><source src="${demoVideo.path}" type="video/mp4"></video><figcaption id="demoNote">${c.note}</figcaption></figure><p class="demo-evidence">${c.evidence}</p><section class="demo-chapters"><h2>${c.chapters}</h2><ol>${c.scenes.map(([time,title,text])=>`<li><span class="demo-time">${time}</span><div><h3>${title}</h3><p>${text}</p></div></li>`).join('')}</ol></section><div class="guide-answers"><section><h2>${c.source}</h2><p>${c.sourceNote}</p><blockquote lang="ja">${script}</blockquote><h3>${c.meaningTitle}</h3><p>${c.meaning}</p><p class="demo-evidence">${c.meaningNote}</p><a href="${base}/sample">${c.sample} →</a></section><section><h2>${c.limits}</h2><p>${c.limitsText}</p></section></div><aside class="guide-next"><h2>${c.next}</h2><p>${c.steps}</p><a class="download-button" href="https://chromewebstore.google.com/detail/bgjpmnfpjjmldfhcggodmbpolgkplmih" target="_blank" rel="noopener">${c.install}</a><a href="${base || '/'}#manual-install">${c.manual} →</a><a href="${base}/how-it-works">${c.how} →</a></aside></main><footer><span>Kotoba Live · DracoNova Inc</span><a href="${base}/policies.html">${c.privacy}</a><a href="mailto:support@kotoba.uk">support@kotoba.uk</a></footer><script type="module" src="/shared/ui-locale.js"></script></body></html>`, {
    locale, pagePath: '/demo', socialImage: { path: demoVideo.poster, width: 1280, height: 720, alt: c.title },
  });
}
