import { plans } from '../server/payment-catalog.js';
import { localizedPage } from './localized-pages.js';
import { subtitleGuide } from './subtitle-guide-content.js';
import { sampleGuide } from './sample-guide-content.js';

const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const price = kind => 'USD ' + (plans[kind].amount / 100).toFixed(2);
const hours = kind => plans[kind].seconds / 3600;

// 指南与 FAQ 同时生成中英文正文；所有金额和额度来自实际计费配置。
export function guideContent(locale) {
  if (locale === 'en') return {
    home: 'Home', how: 'How it works', faq: 'Help & FAQ', signIn: 'Sign in / Try free', privacy: 'Terms & privacy', language: 'Interface language',
    howTitle: 'How to translate Japanese audio in Chrome',
    howDescription: 'Install Kotoba Live and turn Japanese tab audio into English or Chinese subtitles. Learn how to connect your account, adjust captions, and stop translation.',
    howIntro: 'Keep listening to the original Japanese. Read the translation beside it. Kotoba Live adds live subtitles to the tab you choose, including content that has no subtitle track.',
    steps: [
      ['Install the extension', 'Install from the Chrome Web Store using the home page link. If you cannot access the store, download the ZIP from the home page and unzip it into a permanent folder. Open chrome://extensions in desktop Chrome, enable Developer mode, choose “Load unpacked”, and select the folder containing manifest.json. Keep that folder in place.'],
      ['Connect your account', `Sign in on the home page with an email verification code. Your first verified sign-in automatically adds ${plans.trial.seconds / 60} free minutes. Then get an extension connection code. Paste it into Kotoba and connect. You do not need to pay before connecting. Keep the code private; get a new code if it expires.`],
      ['Choose the tab and translation language', 'Open a regular web page that plays Japanese speech. Start playback, click Kotoba in the Chrome toolbar, select English or Simplified Chinese, then start translating the current tab. Pin the extension using Chrome’s puzzle menu for easier access.'],
      ['Read and adjust the captions', 'The subtitle overlay appears near the bottom of the video. Drag it within the webpage, resize the box to show more text without changing font size, and choose whether to show Japanese originals and speaker numbers. Adjust the background in the extension.'],
      ['Stop when you finish', 'Use Stop in the extension when you are done. Stopping capture stops further audio transmission. The account balance refreshes separately; the final usage record can appear after the session finishes.'],
    ],
    sections: [
      ['What happens to the audio?', 'After you start translation, Chrome captures audio from the selected tab. Kotoba sends the audio through its cloud service for speech recognition and translation, then displays incoming caption text. It does not extract or download the page’s video files. The original audio continues playing.'],
      ['Where does it help?', 'Try Japanese courses, interviews, talks, and livestreams in desktop Chrome. It is especially useful when the player has no usable subtitles. If a player already provides good translated captions, those may be sufficient. Compatibility depends on whether Chrome can capture the tab and display the overlay; not every player or protected page is supported.'],
      ['What should I expect from live captions?', 'Captions arrive as speech is processed and may be revised as more context arrives. Background music, overlapping voices, whispering, accents, and network conditions can reduce accuracy or increase delay. Speaker numbers separate voices within a session; they do not identify a person or determine gender. The current product provides subtitles, not translated voice dubbing.'],
      ['What is counted and stored?', 'Time is based on audio received for processing. Silence during playback and translating the same passage again consume time; waiting to connect and time after capture stops do not. Kotoba does not persist audio or subtitle text. Account, payment, and usage records are retained as described in the privacy policy. Processing involves external service providers.'],
    ],
    faqTitle: 'Kotoba Live help and frequently asked questions',
    faqDescription: 'Answers about installing Kotoba Live, connecting an account, live Japanese subtitles, translation time, renewals, privacy, and troubleshooting.',
    faqIntro: 'A practical guide to your first subtitles, your account, and your translation time.',
    questions: [
      ['email-login', 'Why do I not receive an email code, or why does sign-in not finish?', 'Enter your email and click Get code beside the email field. No human verification is required to request the email. Check spam, confirm the address, and wait for the resend countdown before trying again. After entering the six-digit email code, complete human verification and then submit sign-in. If verification fails to load, use Retry in the verification panel or check whether your network or content blocker prevents it from loading.'],
      ['install', 'How do I install or update Kotoba Live?', 'Download and unzip the extension from the home page. In chrome://extensions, enable Developer mode and load the folder containing manifest.json. Do not drag the ZIP into Chrome. To update, replace the files in the same folder with the new release and reload the extension. You can also install from the Chrome Web Store using the home page link; Chrome updates the store version automatically. The manual ZIP remains available if you cannot access the store.'],
      ['browsers', 'Can I use it on mobile or any website?', 'The supported setup is desktop Chrome 116 or later. Chrome settings pages and the Chrome Web Store cannot host the subtitle overlay. Some protected players, embedded frames, or special playback modes may not work. Try the exact content you want to watch during the free trial. Mobile and other browsers are not currently promised.'],
      ['account', 'Is the connection code a paid feature?', 'No. Sign in with your email and request a connection code from your account. Connect the extension, then use trial or purchased time. The code links the extension to your account; it is private and is not a discount or payment code.'],
      ['code', 'Why does my connection code say it expired?', 'An unused connection code is time limited. Request a fresh one on the account page and paste it into the extension. Check your network if verification cannot finish. Do not share the code in screenshots or support messages.'],
      ['languages', 'Which languages and caption controls are available?', 'Japanese speech can be translated to English or Simplified Chinese. The interface language is a separate setting. You can hide Japanese originals, show speaker numbers and colors, adjust the background, and move or resize the subtitle box within the webpage. Resizing does not change the font size.'],
      ['missing-captions', 'Why are no subtitles appearing?', 'Confirm that the extension is connected, your account has time remaining, and the selected tab is playing audible Japanese speech. Start translation from that video tab. After an extension update, reload the page and restart translation. If playback is inside a frame or a special full-screen mode, try the normal page view.'],
      ['interrupted', 'What should I do if translation stops?', 'Read the message in the extension and check your connection and remaining time. Stop and restart after the network recovers. If the problem persists, send support the browser version, approximate time, and error message. Do not include connection codes or private video content.'],
      ['accuracy', 'Are subtitles perfectly accurate or instant?', 'No. Live recognition and translation can contain errors, delays, and changing phrases. Noise, multiple simultaneous speakers, and unclear speech affect quality. Speaker numbers are session labels, not verified identities. Kotoba currently produces text subtitles, not translated audio.'],
      ['trial', 'How does the free trial work?', `Your first successful email verification and sign-in automatically credits ${plans.trial.seconds / 60} minutes once per account. The account page confirms that the free trial has been added and displays your remaining time; there is no separate claim step. No card is required. The trial does not become a paid subscription automatically, and running out of time does not trigger a purchase.`],
      ['plans', 'What do the plans cost?', `Monthly membership is ${price('monthly')} for ${hours('monthly')} hours per billing period, with no rollover. A top-up is ${price('topup')} for ${hours('topup')} hours, valid for ${plans.topup.days} days after crediting. Existing purchases and subscriptions keep their agreed terms. Check the final checkout amount before paying.`],
      ['counting', 'Does silence or replaying a video use time?', 'Yes. Audio received for processing counts in seconds, including silence during playback and translating a passage again after replaying or seeking. Waiting to connect and time after capture stops do not count. Service retries do not deduct the same audio twice. On failures, audio time not confirmed as processed is credited back.'],
      ['renewal', 'Which purchases renew automatically?', 'Monthly membership renews automatically until you cancel renewal on the account page. Canceling preserves valid time in the paid period. Top-ups and the one-time monthly pass do not renew. Trial time never converts to a paid plan automatically.'],
      ['wallet', 'Can I pay with Alipay or WeChat Pay?', `The Chinese interface offers a one-time monthly pass for ${price('monthpass')} with ${hours('monthpass')} hours, valid ${plans.monthpass.days} days after crediting. It does not renew or roll over. This is separate from the recurring monthly membership.`],
      ['payment', 'Why has my time not appeared after checkout?', 'Time is granted after the payment provider confirms payment. Returning to the website alone does not prove payment succeeded. Refresh your balance and check that you signed into the purchase account. If time is still missing, contact support with your purchase email and order reference.'],
      ['privacy', 'Is my audio stored or used for advertising?', 'Kotoba captures the chosen tab only after you start translation and does not persist audio or caption text. External services process audio while translation is active. Necessary account, order, and usage records are retained; the service does not use advertising tracking cookies. Read the privacy policy for providers and retention details.'],
      ['refund', 'How do I request help or a refund?', 'Email support@kotoba.uk with your purchase email, order reference if relevant, and a description of the issue. Refund requests are reviewed against payment and usage records. Canceling a subscription is not itself a refund. Applicable consumer rights remain unaffected.'],
    ],
    next: 'Ready for your first subtitles?', cta: 'Download & start your free trial', related: 'Read the installation guide', updated: 'Updated 11 September 2026',
  };
  return {
    home: '首页', how: '如何工作', faq: '帮助与常见问题', signIn: '登录 / 免费试用', privacy: '服务与隐私', language: '界面语言',
    howTitle: '在 Chrome 中，把日语原声变成实时字幕',
    howDescription: '了解 Kotoba Live 如何采集标签页音频、生成中英文字幕，以及安装、连接账户、调整字幕和停止翻译的完整步骤。',
    howIntro: '耳边保留日语原声，眼前读懂译文。Kotoba Live 为你选择的标签页提供实时字幕，没有字幕轨道的内容也可以尝试。',
    steps: [
      ['安装插件', '推荐使用首页的 Chrome 商店入口安装。无法访问商店时，从首页下载 ZIP，解压到固定文件夹。在电脑端 Chrome 中打开 chrome://extensions，开启「开发者模式」，点击「加载已解压的扩展程序」，选择含 manifest.json 的文件夹。安装后保留该文件夹。'],
      ['连接账户', `在首页用邮箱验证码登录，首次验证邮箱并登录后自动到账 ${plans.trial.seconds / 60} 分钟免费试用，再获取插件连接码。把连接码粘贴到 Kotoba 并连接账户。连接前无需付费，请勿分享连接码；过期后可重新获取。`],
      ['选择标签页与目标语言', '在普通网页中播放日语内容，点击 Chrome 工具栏中的 Kotoba，选择中文或英文，再点击「开始翻译当前标签页」。可通过 Chrome 拼图菜单固定插件，方便下次打开。'],
      ['阅读并调整字幕', '字幕初始显示在视频下方。你可以在网页范围内拖动字幕框，扩大宽高以显示更多内容，字号保持不变；也可以关闭日文原文、显示说话人编号，并在插件中调整背景深浅。'],
      ['观看结束后停止', '结束时在插件中点击停止，停止采集后不再发送新的音频。账户余额单独刷新，最终使用记录可能在会话结束后才更新。'],
    ],
    sections: [
      ['声音如何变成字幕？', '只有你主动开启翻译后，Chrome 才采集所选标签页的声音。音频经 Kotoba 云端发送给语音处理服务，完成识别和翻译，再把字幕送回网页。插件不解析或下载页面的视频文件，原声仍会播放。'],
      ['适合用在哪里？', '可以尝试电脑端 Chrome 中的日语课程、访谈、演讲和直播，尤其适合没有可用字幕的内容。如果播放器已有满意的翻译字幕，直接使用原有字幕也许就足够。兼容性取决于 Chrome 能否采集音频及显示字幕，不能保证所有播放器或受保护页面都支持。'],
      ['实时字幕有哪些限制？', '字幕随语音处理陆续出现，后续上下文可能带来修订。背景音乐、多人同时说话、低声说话、口音及网络情况都可能影响准确度或延迟。说话人编号用于区分本次会话中的声音，不确认真实身份，也不判断性别。目前提供文字字幕，不提供翻译后的语音配音。'],
      ['如何计时，保存哪些数据？', '按服务端接收处理的音频时长计时，播放中的静音和重复翻译也占用时长；等待连接和停止采集后不计时。Kotoba 不持久保存音频或字幕正文。账户、订单和使用记录按隐私说明保留，实时处理会涉及外部服务提供商。'],
    ],
    faqTitle: 'Kotoba Live 帮助与常见问题',
    faqDescription: '关于 Kotoba Live 安装、账户连接、实时日语字幕、翻译时长、付费续订、隐私与常见故障的解答。',
    faqIntro: '从第一句字幕到每一分钟时长，在这里找到具体的使用说明。',
    questions: [
      ['email-login', '收不到邮箱验证码，或点击登录没有完成怎么办？', '填写邮箱，点击邮箱右侧的「获取验证码」，这一步无需人机验证。检查垃圾邮件及邮箱拼写，并在重发倒计时结束后再试。填入 6 位邮箱验证码后，完成下方人机验证，再点击「登录 / 注册」。如验证组件加载失败，使用验证区域的重试入口，并检查网络或内容拦截设置。'],
      ['install', '如何安装或更新插件？', '从首页下载并解压扩展包，在 chrome://extensions 开启开发者模式，加载直接包含 manifest.json 的文件夹。不要把 ZIP 直接拖入 Chrome。更新时将新版本文件替换到同一文件夹，再点击扩展的重新加载按钮。也可通过首页的 Chrome 商店入口安装，由 Chrome 自动更新。无法访问商店时仍可使用本站的手动安装包。'],
      ['browsers', '手机和所有网站都能使用吗？', '目前支持电脑端 Chrome 116 及以上版本。Chrome 设置页、Chrome 网上应用店无法显示字幕浮层；部分受保护播放器、嵌入框架或特殊播放模式也可能不兼容。建议用免费试用测试你实际观看的内容。目前不承诺手机端和其他浏览器支持。'],
      ['account', '获取连接码需要先付费吗？', '不需要。用邮箱登录后即可获取连接码，在插件中连接账户，再使用已领取的试用或已购买时长。连接码用于关联账户，不是优惠码或付款凭证，请妥善保管。'],
      ['code', '连接码为什么会显示过期？', '未使用的连接码有时间限制。请在账户页获取新码，再粘贴到插件。如果验证一直未完成，请检查网络连接。不要在截图或支持邮件中分享连接码。'],
      ['languages', '支持哪些语言和字幕设置？', '日语可翻译为简体中文或英文，界面语言独立选择。支持隐藏日文原文、显示说话人编号和颜色、调整背景深浅，以及在网页内移动和缩放字幕框。调整字幕框大小不会改变字号。'],
      ['missing-captions', '为什么没有出现字幕？', '先确认已连接账户、还有剩余时长，且所选标签页正在播放可听见的日语。从实际播放视频的标签页启动翻译。更新插件后可刷新网页并重新启动。如果视频在嵌入框架或特殊全屏模式中，尝试返回普通网页视图。'],
      ['interrupted', '翻译中断了怎么办？', '查看插件内提示，检查网络和剩余时长。网络恢复后停止并重新开始。如果持续出现问题，联系客服提供浏览器版本、大致发生时间和错误提示；不要发送连接码或私人视频内容。'],
      ['accuracy', '字幕是否完全准确、没有延迟？', '不是。实时识别和翻译可能出错、延迟或修订已显示的内容，噪音、多人重叠和含糊语音都会影响效果。说话人编号只是会话标签，不代表身份验证。目前输出文字字幕，不生成翻译后的声音。'],
      ['trial', '免费试用如何到账和使用？', `首次验证邮箱并登录成功后，每个账户自动获得一次 ${plans.trial.seconds / 60} 分钟免费试用。账户页会提示「20 分钟免费试用已到账」并显示剩余时长，无需额外点击领取，也无需银行卡。试用不会自动变成订阅，时长用完也不会自动购买。`],
      ['plans', '套餐价格是多少？', `月度会员 ${price('monthly')}，每个订阅周期 ${hours('monthly')} 小时，不结转；加时包 ${price('topup')}，含 ${hours('topup')} 小时，到账后 ${plans.topup.days} 天有效。已购买时长与现有订阅仍按购买时约定执行，最终金额以收银台为准。`],
      ['counting', '静音和回放也会扣时长吗？', '会。服务端接收处理的音频按秒累计，播放中的静音、回放和跳转后重新翻译均计时。连接等待及停止采集后不计时；服务自身重试不重复扣同一段音频，故障时补回未确认处理的音频时长。'],
      ['renewal', '哪些套餐会自动续费？', '月度会员自动续订，可以在账户页取消后续续订，取消后已支付周期的有效时长仍可使用。加时包和一次性月包不续费，免费试用也不会自动转为付费方案。'],
      ['wallet', '可以使用支付宝或微信支付吗？', `中文页面提供一次性月包，${price('monthpass')} 含 ${hours('monthpass')} 小时，到账后 ${plans.monthpass.days} 天有效，不自动续费、到期不结转。它与自动续订的月度会员是不同方案。`],
      ['payment', '付款后为什么还没看到时长？', '付款服务确认成功后才会发放时长，仅返回网站不代表支付成功。请刷新余额，并确认登录的是购买时使用的账户。如果仍未到账，联系客服提供购买邮箱和订单编号。'],
      ['privacy', '会保存音频或用于广告吗？', 'Kotoba 仅在主动开始翻译后采集所选标签页，不持久保存音频和字幕正文。实时翻译会将音频交给外部服务处理；必要的账户、订单和使用记录会保留，服务不使用广告追踪 Cookie。服务商及留存详情请查看隐私说明。'],
      ['refund', '如何获取帮助或申请退款？', '请发邮件至 support@kotoba.uk，提供购买邮箱、相关订单编号及问题描述。我们核对付款和使用记录后处理。取消续订不等于退款，适用消费者法律赋予的权利不受影响。'],
    ],
    next: '准备好看懂第一句了吗？', cta: '下载插件，开始免费试用', related: '阅读完整使用指南', updated: '更新于 2026 年 9 月 11 日',
  };
}

export function guidePage(kind, locale) {
  const c = guideContent(locale), faq = kind === 'faq', base = locale === 'en' ? '/en' : '';
  const article = kind === 'subtitle-guide' ? subtitleGuide(locale) : kind === 'sample' ? sampleGuide(locale) : null;
  if (article) c.howIntro = article.intro;
  if (article) c.updated = locale === 'en' ? 'Updated 9 September 2026' : '更新于 2026 年 9 月 9 日';
  const title = article?.title || (faq ? c.faqTitle : c.howTitle), description = article?.description || (faq ? c.faqDescription : c.howDescription);
  const articleIntro = article?.choices ? `<div class="guide-table"><table><thead><tr>${article.headings.map(h=>`<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${article.choices.map(row=>`<tr>${row.map(p=>`<td>${escape(p)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : article ? `<audio controls preload="none" aria-label="${escape(article.audioLabel)}"><source src="/demo/japanese-study.wav" type="audio/wav"></audio><p>${escape(article.audioNote)}</p>` : '';
  const body = article ? `${articleIntro}<div class="guide-answers">${article.sections.map(([h,p,lang])=>`<section><h2>${escape(h)}</h2><p${lang ? ` lang="${lang}"` : ''}>${escape(p)}</p></section>`).join('')}</div><p><a href="${base}/${kind === 'sample' ? 'subtitle-guide' : 'sample'}">${locale === 'en' ? (kind === 'sample' ? 'Choose a subtitle workflow' : 'Listen to a tested sample') : (kind === 'sample' ? '选择适合的字幕方式' : '试听实测样本')} →</a></p>` : faq
    ? `<nav class="guide-contents" aria-label="${escape(c.faq)}">${c.questions.map(([id,q])=>`<a href="#${id}">${escape(q)}</a>`).join('')}</nav><div class="guide-answers">${c.questions.map(([id,q,a])=>`<section id="${id}"><h2>${escape(q)}</h2><p>${escape(a)}</p></section>`).join('')}</div>`
    : `<ol class="guide-steps">${c.steps.map(([h,p],i)=>`<li><span class="eyebrow">0${i+1}</span><div><h2>${escape(h)}</h2><p>${escape(p)}</p></div></li>`).join('')}</ol><div class="guide-answers">${c.sections.map(([h,p])=>`<section><h2>${escape(h)}</h2><p>${escape(p)}</p></section>`).join('')}</div>`;
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · Kotoba Live</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="https://kotoba.uk/${kind}"><meta property="og:type" content="website"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="https://kotoba.uk/${kind}"><link rel="stylesheet" href="/pricing.css"><link rel="stylesheet" href="/guides.css"></head><body><header><a class="brand" href="${base || '/'}">Kotoba Live</a><nav aria-label="${escape(c.home)}"><a href="${base}/how-it-works">${escape(c.how)}</a><a href="${base}/faq">${escape(c.faq)}</a></nav><div class="header-actions"><select data-ui-language aria-label="${escape(c.language)}"><option value="zh-CN">简体中文</option><option value="en">English</option></select><a class="account-entry" href="${base || '/'}#loginPanel">${escape(c.signIn)}</a></div></header><main class="guide-page"><p class="eyebrow">KOTOBA GUIDE</p><h1>${escape(title)}</h1><p class="guide-intro">${escape(faq?c.faqIntro:c.howIntro)}</p><p class="guide-updated">${escape(c.updated)}</p>${body}<p><a href="${base}/demo">${locale === 'en' ? 'Watch Japanese-to-Chinese captions in a real Chrome recording' : '观看日语转中文字幕实机录屏'} →</a></p><aside class="guide-next"><h2>${escape(c.next)}</h2><a class="download-button" href="${base || '/'}#install">${escape(c.cta)}</a><a href="${base}/${faq?'how-it-works':'faq'}">${escape(faq?c.related:c.faq)} →</a></aside></main><footer><span>Kotoba Live · DracoNova Inc</span><a href="${base}/policies.html">${escape(c.privacy)}</a><a href="mailto:support@kotoba.uk">support@kotoba.uk</a></footer><script type="module" src="/shared/ui-locale.js"></script></body></html>`;
  return localizedPage(html, { locale, pagePath: '/' + kind });
}
