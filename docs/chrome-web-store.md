# Kotoba Live — Chrome Web Store 提交材料

状态（2026-09-09）：0.2.0 已提交 Chrome Web Store，后台显示 Pending review；审核通过后自动公开发布。尚未上架。

## 发布者与资源

- Publisher: DracoNova Inc
- Contact: support@kotoba.uk（Google 已显示 Verified email address）
- Trader: 商业发布者；公司名称和邮寄地址已与用户提供的注册文件核对，用户授权公开的手机号已完成短信验证，Google 已显示 Verified account。
- ZIP: dist/kotoba-live-0.2.0.zip；Manifest V3，最低 Chrome 116，默认英文，含简体中文 locale。
- 网站：https://kotoba.uk/en
- 支持：https://kotoba.uk/en/faq
- 隐私：https://kotoba.uk/en/policies.html#privacy
- 图片：assets/store/captions.jpg、start.jpg、settings.jpg 均 1280×800；promo-440x280.jpg；icon-128.png。
- 图中插件为实际代码渲染的 UI，账户、余额和字幕是标明的演示数据，无第三方视频或个人账号截图。生成：先 node scripts/package-production.js，再 PLAYWRIGHT_MODULE=<playwright module path> node scripts/store-assets.mjs。

## English listing

Name: Kotoba Live — Japanese Live Subtitles

Short description: Translate Japanese tab audio into live subtitles. Keep the original sound and adjust captions as you watch.

Detailed description:

Kotoba Live adds live translated subtitles to Japanese audio in the Chrome tab you choose. Follow courses, interviews, talks, and livestreams while keeping the original sound.

Start with a one-time 20-minute free trial. No card is required. Sign in at kotoba.uk with an email verification code, get your connection code, and connect the extension. Then play Japanese audio and select “Translate this tab”.

• Translate Japanese speech into English or Simplified Chinese.
• Show or hide the original Japanese text.
• Move subtitles within the webpage and resize the box without changing font size.
• Distinguish speakers using session numbers and colors.
• Adjust the background for easier reading.
• Check your remaining translation time in the extension.

Kotoba captures the selected tab only after you start translation. Audio is sent through our cloud for speech recognition and translation. The original audio continues playing. Kotoba does not persist audio or subtitle text. Optional context and terms you enter are sent to help interpret the speech. Read our privacy policy for details about service providers and retained account records.

Desktop Chrome 116 or later is required. Some protected pages, embedded players, and special playback modes may not work. Captions can contain recognition errors, translation errors, delays, and speaker confusion. This version provides text subtitles, not translated voice dubbing.

After the trial, paid translation time is available at kotoba.uk. Monthly membership is USD 19.99 for 20 hours per billing period and renews until canceled. A USD 9.99 top-up provides 10 hours valid for 90 days without renewal. The trial never becomes a paid plan automatically. Running out of time stops translation and does not trigger another purchase.

Help: https://kotoba.uk/en/faq
Privacy: https://kotoba.uk/en/policies.html#privacy
Contact: support@kotoba.uk

## 简体中文条目

名称：Kotoba Live — 日语实时翻译字幕

简短说明：将当前标签页中的日语音频翻译成实时字幕，保留原声，自由调整字幕位置与显示方式。

详细说明：

Kotoba Live 为你选择的 Chrome 标签页添加日语实时翻译字幕。用原声听课程、访谈、演讲和直播，同时阅读中文或英文译文。

新用户可领取一次性 20 分钟免费试用，无需银行卡。在 kotoba.uk 使用邮箱验证码登录，获取连接码并连接插件，然后播放日语内容，点击「开始翻译当前标签页」。

功能包括：日语到简体中文或英文；显示或隐藏日文原文；在网页中拖动字幕、调整字幕框宽高且保持字号；说话人编号和颜色；调整背景深浅；在插件中查看剩余翻译时长。

只有你开始翻译后，插件才采集所选标签页声音，并经云端完成识别和翻译。原声继续播放。Kotoba 不持久保存音频或字幕正文。可选的背景说明与术语会随请求发送，服务商和账户记录留存详见隐私说明。

适用于电脑端 Chrome 116 及以上版本。部分受保护页面、嵌入播放器和特殊播放模式可能不支持。字幕可能有错误、延迟和说话人混淆。目前仅提供文字字幕，不提供语音配音。

试用后可购买翻译时长：月度会员每月 USD 19.99，含每个订阅周期 20 小时，自动续订至取消；加时包 USD 9.99 含 10 小时，到账后 90 天有效，不自动续费。免费试用不会自动转付费，用完时长也不会自动加购。

帮助：https://kotoba.uk/faq
隐私：https://kotoba.uk/policies.html#privacy
客服：support@kotoba.uk

## Privacy practices / 单一用途

Single purpose: Provide user-initiated live translated subtitles for Japanese speech playing in the selected Chrome tab.

Permissions justification:

- activeTab: Access the tab explicitly selected by the user to attach subtitles and check whether it is a normal web page. No persistent access to browsing history.
- tabCapture: Capture audio from the selected tab after the user starts translation; stop capture when translation stops.
- offscreen: Maintain the user-initiated audio stream and AudioWorklet while the extension popup is closed.
- scripting: Inject the packaged caption overlay into the user-selected tab when translation starts.
- storage: Store the user's connection credential and display preferences locally, and keep current-session state such as tab ID/title, status and usage for popup continuity.

Remote code: No remotely hosted executable code. Extension JavaScript, AudioWorklet and styling are bundled. Network responses contain service data, not code to execute.

Data disclosures to select and explain after matching the portal's current labels:

- Personally identifiable information: email used by the website account, account references and necessary support records.
- Authentication information: connection credential locally stored and sent to Kotoba to authenticate requests; no passwords collected by the extension.
- Financial/payment information: subscription/order status and time entitlements; card details handled by Stripe, not by the extension.
- Location: IP address used for security and abuse prevention on the service, as disclosed in the privacy policy; no GPS permission or precise location collection. The portal category was selected.
- Website content: user-selected tab audio, generated captions, and optional user-provided context/terms. Audio and captions transient, not persisted by Kotoba.
- Audio may appear as a separate category or under website content in the current form; disclose it explicitly in the explanation.
- Do not claim browsing history is uploaded: the selected tab URL/title is examined locally for functionality; code sends audio/config/auth, not browsing history. No blanket permission to read all tabs.
- No sale of personal data, no advertising personalization, no credit/lending use. Use only to provide/improve the user-facing functionality and permitted support/security/payment operations. Review the actual checkboxes before attesting.

## Reviewer instructions

1. Install this MV3 package in desktop Chrome 116+.
2. Visit https://kotoba.uk/en and sign in using an email verification code. Public registration is enabled. A Turnstile human check may be required.
3. Claim the free 20-minute trial; no payment or card is necessary. Obtain a connection code and paste it into the extension.
4. Open a normal webpage playing Japanese speech that you are entitled to process. Click Translate this tab.
5. Verify captions, original-text toggle, move/resize controls and remaining time. Stop translation afterward.
6. Payment is not required to review the subtitle functionality. Do not provide a short-lived connection code as permanent reviewer credentials. If Google requires a fixed review account/access arrangement, prepare an appropriately scoped solution separately; do not disable production login or quota checks.

## Submission status

Submitted on 2026-09-09. Google displayed “Your extension was submitted for review”; the Status page then displayed “Pending review” and “This draft is pending review.” Approval date and public listing URL remain pending.

- Item ID: `bgjpmnfpjjmldfhcggodmbpolgkplmih`
- Dashboard: https://chrome.google.com/webstore/devconsole/d6d3d48b-70f3-4f17-9176-e6489635c230/bgjpmnfpjjmldfhcggodmbpolgkplmih/edit/status
- Publisher display name: DracoNova Inc; contact email and trader account both verified.
- Saved: English and Chinese descriptions, category Tools, three screenshots, icon and small promotional tile, official site and support/privacy URLs.
- Saved: five permission justifications, no remotely hosted code, five data categories (identity, authentication, financial/payment, location/IP, website content), and the three data-use declarations.
- Reviewer instructions use public email OTP sign-in and the free 20-minute trial, with https://kotoba.uk/en/sample for testing. No expiring code or password was stored in the listing.
- Distribution: Public, all regions, contains in-app purchases. “Publish automatically after it has passed review” was checked when submitting.
- The first upload was rejected because the English manifest description exceeded 132 characters. Shortened it and added a locale description-length assertion in scripts/check.js; rebuilt 0.2.0 and successfully uploaded it. No previous store release existed.
- Keep the website ZIP installation path until approval and a working public store page are confirmed.

### 2026-09-08 组织验证进度

- 用户提供的秘书卡与 Wyoming 注册文件一致，注册文件明确列出公司 mailing address；Google 账户已有对应 DracoNova Inc Organization payments profile，已在流程中选用并核对。
- Google 表单要求公司名称、地址、手机号；D-U-N-S 为可选项。页面明确手机号将公开，并通过短信验证码验证。
- 文件中的联系电话与代办机构邮箱一起出现，未将其当作用户控制的客服电话，也没有向其发送验证码。已向用户询问有权使用、能够接收短信且允许公开的号码。
- 手机验证尚未完成，因此身份资料未最终提交；重载后会重新出现强制 trader 引导。不得选择 non-trader 绕过商业验证，也不得将准备步骤标记为认证完成。
- Google 组织资料已有街道行包含城市/州/邮编的重复格式，后续填表时应按注册文件规范化街道与城市字段。修改共享 payments profile 前核对其提示的影响范围。
- 公司文件仅解包到系统临时目录用于核对；未复制到项目或扩展安装包。仅在 Google 要求公司证明时上传必要的注册文件，不上传整个 ZIP 或无关税务/财务材料。

### 安装包最终核验

- 版本 0.2.0；MV3；最低 Chrome 116；35 个文件，80,606 字节（2026-09-09 商店描述修正后重打包）。
- 已将新包同步到正式下载 `https://kotoba.uk/downloads/kotoba-live.zip`，线上返回 200，字节与本地一致；ZIP SHA-256：`2b6283307f4773dbe5a2ec91900a59f01f494f43eeb437a9419fd2eaf1f6b8b5`。
- ZIP 未包含 .env、.git 或 node_modules 路径；权限为 activeTab、tabCapture、offscreen、storage、scripting。
- 这些检查证明下载与准备提交的包一致，不代表已通过商店审核。
- 本次部署版本：`5d973458-baa6-43ae-bb0e-d025cb143687`；仅一个静态资源 ZIP 发生上传变化。复核 12 个 HTML、音频、JS、ZIP 与本地一致；sitemap 12 个 URL；私有接口未登录 401。语法与扩展清单检查通过。
- Wrangler 报告共享文案中的“服务与退款说明”存在重复 key，后值生效，未阻止部署；本次未修改已送审代码处理此既有警告。
