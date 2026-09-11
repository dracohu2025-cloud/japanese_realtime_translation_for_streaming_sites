# Product Hunt 发布材料

状态：2026-09-10 已登录个人账号 draco hu（@draco_hu）。用户要求重试后，正常刷新成功进入详情表单，已填写必填项，页面显示 Required 100% Complete。点击 Create draft 后未返回成功结果，随后页面显示 403 / You don't have access to this page；日志确认 Apollo 请求收到 403。未确认草稿保存成功，未发布。

## 表单内容

- Name: Kotoba Live
- Tagline: Live translated subtitles for Japanese audio in Chrome
- Website: https://kotoba.uk/en?utm_source=producthunt&utm_medium=referral&utm_campaign=launch
- Pricing: Paid with a free trial
- Topics: Chrome Extensions / Languages / Productivity（按平台实际可选项选择最相关的 2–3 项）
- Availability: Available（官网可用；明确手动 ZIP 安装，不宣称 Chrome Web Store 已上架）
- Maker: 使用用户实际登录的个人账号，不创建公司账号或虚构其他参与人。

Description（当前表单上限 500 字符，实际填写如下）:

Turn Japanese audio in your chosen Chrome tab into live English or Chinese subtitles, even without an existing subtitle track. Keep the original voice, show optional Japanese text, and move or resize captions. Includes a one-time 20-minute trial with no card required. Desktop Chrome; currently installed manually from a ZIP.

## First comment

Hi Product Hunt — I'm the maker of Kotoba Live.

It's for Japanese talks, interviews, and livestreams that don't have usable translated captions. Kotoba listens to the Chrome tab you choose and displays translated text while the original audio keeps playing.

You can translate into English or Chinese, show the Japanese original, move and resize the subtitle box, and check your remaining translation time in the extension.

A couple of things to know before trying it: installation currently requires downloading a ZIP and loading it through Chrome's developer mode. The website walks through the steps. Speech recognition and translation run in the cloud; noise, overlapping voices, and network conditions can cause errors or delays. Some protected pages and players may not work.

New accounts get a one-time 20-minute trial with no card required. After that, membership is $19.99/month for 20 hours, or you can buy a non-renewing $9.99 top-up for 10 hours, valid for 90 days.

I'd love to hear which Japanese content you wish had translated captions, and whether the first-use setup is clear enough. Thanks for taking a look!

## 已检查的图片

Gallery 推荐顺序：

1. `assets/store/start.jpg`：实际插件 UI，英文文案，已标注演示账户与余额。
2. `assets/store/captions.jpg`：实际字幕框 UI，已标注示例字幕，不冒充识别准确率证据。

两张均为 1280×800；平台建议 1270×760，是否需要调整以实际上传校验为准。

Thumbnail 候选：`assets/store/icon-128.png`，方形品牌图标。平台建议 240×240，若实际校验要求更大尺寸再由现有品牌源图导出。

官网已有英文介绍视频；本地另外准备了英文操作提示的实录 `videos/kotoba-live-recording/reddit/renders/kotoba-live-reddit-demo-1080p.mp4`，其中实际字幕是日语到中文，不宣称为日语到英语实录。

## 当前发布限制与操作边界

- Product Hunt 官方说明：需个人账号；新账号可能需要完成 onboarding，发帖权限说明还列出一周等待或订阅 newsletter 的选项。以实际账号和表单状态为准，不擅自订阅或购买服务。
- 视频栏仅支持完整 YouTube 链接；没有可用链接时先用至少两张图片，不填 MP4 地址，不因为上传视频去创建第三方账号。
- 不填写虚构促销码、评价、用户量、商店链接或未验证的社交账号。
- 若表单只能预约日期，记录实际可选项再决定；不把本地文档称作已保存的平台草稿。

## 结果

- 登录账号：draco hu（@draco_hu），Google 邮箱 dracohu2025@gmail.com。
- 平台草稿链接：未确认创建，不应再次提交前假定没有草稿；恢复访问后先检查。
- 正式发布链接：尚未发布。
- 实际发布日期：尚未发布。

### 2026-09-10 访问拦截记录

- 入口：/posts/new；账号可以打开官网链接输入表单。
- 第一次填入带协议链接时，表单显示重复协议 https://https://kotoba.uk/en 并报告链接无效。
- 按表单行为改为 kotoba.uk/en 后点击 Get started，跳转 https://www.producthunt.com/posts/new/submission。
- 页面显示 “Sorry, you have been blocked / You are unable to access producthunt.com”。
- Cloudflare Ray ID: a389d826ef17c0b4。
- 无法从页面确认具体触发原因，不将其解释为账号封禁或产品被拒绝。
- 保留页面交由用户处理，不反复提交或更换网络规避拦截。

### 2026-09-10 用户要求重试后的进展

- 正常刷新后进入 Main info；名称和 https://kotoba.uk/en 由平台预填。
- 已填 tagline、description、first comment，分类已选 Chrome Extensions。其他分类搜索未可靠返回，未乱选。
- 已选择 I worked on this product，当前账号 @draco_hu 出现在 Makers。
- 已选择 Paid (with a free trial or plan)。未填促销码、融资声明、投资人联系表或外部产品推荐。
- 媒体：平台自动抓取了官网品牌展示图。图标及三张产品图尝试通过文件选择器上传，但没有出现新增图库项，不能标记为上传成功。
- 现行界面支持可选 YouTube 或 Loom 链接（比帮助页仅提 YouTube 更宽）；未填不存在的视频链接。
- Launch checklist 显示 Required 100% Complete；只提供 Schedule launch for later 和 Create draft。
- 点击 Create draft 一次后按钮一直禁用，未返回草稿链接；日志随后记录 Response not successful: Received status code 403，页面最终显示 You don't have access to this page。
- 后续先恢复账号访问并查看已有草稿，避免重复创建。不能把本地材料或必填完成度称为发布成功。

参考：

- https://help.producthunt.com/en/articles/479557-how-to-post-a-product
- https://help.producthunt.com/en/articles/481909-how-can-i-get-access-to-post
