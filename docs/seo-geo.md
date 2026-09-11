# kotoba.uk SEO / GEO

## 当前状态（2026-09-11）

最新执行、后台事实和验证记录见 [本轮推进记录](seo-geo-2026-09-11.md)。下方带日期的段落保留历史快照，不能把当时的“未上架 / 待验证”当成当前状态。

- Chrome 商店已有公开安装入口，官网继续保留 ZIP 手动安装。
- 新增 `/demo`、`/en/demo` 真实 Chrome 日译中录屏观看页；公开 sitemap 现有 14 个规范 URL。已加入 VideoObject、双语标记和站内入口。
- FAQ 和安装指南已同步首次验证邮箱登录自动赠送 20 分钟，以及当前邮件验证码 / 人机验证流程。
- 本次 12 个新增或更新 URL 的 IndexNow 通知返回 200；仅表示提交成功，不代表抓取或收录。
- 后台抽查：首页已被 Google 索引；英文 FAQ 为“已发现但未索引”；Bing `/en` 为“已发现但未抓取”；Bing AI Performance 当前为 0 引用。
- 已看到经 Cloudflare 验证的 Claude-SearchBot 访问 `/sitemap.xml`，状态 Not mitigated；还没有本轮正文抓取或实际 AI 引用证据。

给后续实现（含 Codex）用的进度说明。产品是 **Kotoba Live（ことば）**，正式站 `https://kotoba.uk`，运营主体 DracoNova Inc。首页由生产 Worker `kotoba-live` 把 `/` 与 `/pricing` 映射到 `pricing.html`。

SEO 指搜索引擎可见性；GEO 指大模型检索/引用（`llms.txt`、可抓取英文说明、允许 AI 读取、禁止训练信号）。两者共用同一套公开页面，**不要为爬虫或模型另做一套不可见文案**。

## 硬约束（后续改动必须遵守）

- 公开页面、meta、JSON-LD、`robots.txt`、`sitemap.xml`、`llms.txt`、商店文案 **不得出现具体视频站、成人站或盗版站名称**（测试里会拒绝 `missav` 等）。
- 产品表述只用通用说法：采集 **当前 Chrome 标签页音频**，在课程、访谈、直播及其他正在播放日语的页面上显示实时字幕；**不下载、不解析网站的视频文件**。原声保留。
- 不要用隐藏文字、白字、`display:none` 关键词堆砌、伪装列表或 cloaking。首页 `#about` 里的 `.crawl-en` 是给中文页上的爬虫看的可见英文段；用户把界面切到英文后用 CSS `html[lang="en"] .crawl-en { display: none }` 避免重复，这不是藏关键词。
- 内测 Worker / 非 `PAYMENT_MODE=live` 必须保持 `X-Robots-Tag: noindex, nofollow`，且 `robots.txt` 为 `Disallow: /`。
- 新增公开 URL 必须同时：加入 `cloud/worker.js` 的静态路径白名单、按需写入 `cloud/seo.js` 的 sitemap / `llms.txt`、补 `tests/seo.test.js` 与 `scripts/cloud-test.js`。只加 HTML 不加白名单会 404。
- 不要把未提交的计费/月包改动和本专题混在一起提交。工作区里可能已有 `server/payments.js`、`web/pricing.js` 等与 SEO 无关的脏文件。

## 已完成

### 代码

| 能力 | 位置 |
| --- | --- |
| `robots.txt` / `sitemap.xml` / `llms.txt` | `cloud/seo.js` 的 `robotsTxt`、`sitemapXml`、`llmsTxt`、`discovery` |
| Worker 在源站校验前做发现文档与 301 | `cloud/worker.js`：`canonicalLocation` → `discovery` → 静态页 |
| 正式 robots | `Allow: /`，`Content-Signal: search=yes, ai-input=yes, ai-train=no`，`Sitemap: https://kotoba.uk/sitemap.xml` |
| 站点地图 | 中英文首页、政策、如何工作、FAQ、字幕选择指南、实测样本、实机演示共 14 个 URL（`/pricing` 不单列） |
| `llms.txt` | 英文产品说明书：标签页音频、定价、Chrome 商店与手动安装、试用、实录与样本、客服邮箱 |
| http / `www` → `https://kotoba.uk` 301 | `canonicalLocation()`；`wrangler.production.jsonc` 已加自定义域 `www.kotoba.uk` |
| 首页 SEO | `web/pricing.html`：title、description、canonical、OG、Twitter `summary`、JSON-LD（`WebSite` / `Organization` DracoNova Inc / `SoftwareApplication` 含试用 $0、月费 $19.99 / 20 小时、加时 $9.99 / 10 小时） |
| 可见产品说明 | `#about`：中文段落 + 可见英文 `.crawl-en` |
| 政策页 SEO | `web/policies.html`：title、description、canonical、OG |
| 界面语言切换时改 meta | `extension/shared/ui-locale.js` 翻译 `description` / `og:*` / `twitter:*` 的 `content`（源文在 `messages.js`） |
| 测试 | `tests/seo.test.js`；`scripts/cloud-test.js` 检查正式 robots/sitemap/llms，并断言 llms 不含 `missav` |

### 线上（生产已部署）

已核对：

- `https://kotoba.uk/` 200，带 title / `#about`
- `https://kotoba.uk/robots.txt`、`/sitemap.xml`、`/llms.txt` 200
- `http://kotoba.uk/...` 与 `https://www.kotoba.uk/...` 301 到 `https://kotoba.uk` + 原 path/query
- Googlebot / Bingbot / GPTBot / ClaudeBot / PerplexityBot UA 访问 HTTPS apex 为 200

本机 DNS 若走 Clash fake-ip（常见 `198.18.x`），核对记录请用 Cloudflare DoH：`https://cloudflare-dns.com/dns-query`。Wrangler OAuth **不能**改 Zone DNS（403），DNS TXT 只能在 Cloudflare Dashboard 或已登录的 Domain Connect 流程里加。

### Google Search Console（2026-09-08）

- 账号：`dracohu2025@gmail.com`
- 属性类型：**Domain** `kotoba.uk`（不是 URL prefix）
- 验证：Cloudflare Domain Connect 写入 apex TXT `google-site-verification=...`，状态 Ownership auto verified。**不要删除这条 TXT。**
- 已提交 sitemap：`https://kotoba.uk/sitemap.xml`（Success，发现 2 个 URL）
- 已对 `https://kotoba.uk/` 与 `https://kotoba.uk/policies.html` 点过 Request indexing；当时均为 *Discovered - currently not indexed*，已进优先队列。
- Overview 报表仍会显示 “Processing data, please check again in a day or so”。**不要反复 Request indexing。**
- Google 欢迎邮件 `Improve Google presence for kotoba.uk`（`sc-noreply@google.com`）只是验证确认，无额外密钥。

控制台：`https://search.google.com/search-console?resource_id=sc-domain%3Akotoba.uk`

## 后续工作与分项记录

下列都不阻塞现有收录，但按投入产出排列。实现时保持白帽，并更新本文件的「已完成」节。

### 1. Bing Webmaster Tools（已验证）；IndexNow（已部署，首批通知已受理）

- 用同一 Google 验证导入，或再加一条 Bing 的 DNS TXT，添加 Domain `kotoba.uk`。
- 提交 `https://kotoba.uk/sitemap.xml`。
- 可选：生产 Worker 在 sitemap 或公开页变更时向 IndexNow 提交（需 IndexNow key 文件放在站点根并加入 Worker 白名单）。没有 key 就先只做 Bing 控制台。
- 验收：Bing 属性已验证；sitemap 已提交。
- 当前结果：用户授权后，通过 Google Search Console 仅导入 `https://kotoba.uk/`，Bing 显示 Site addition successful。手动提交 sitemap 后显示 Submitted / Processing；收录仍待 Bing 抓取与处理。详见文末本轮记录。
- 2026-09-09 后续已部署 IndexNow 所有权验证端点与发布后提交脚本；默认只预检，不自动重提。首批 3 个本次更新的英文 URL 返回 202，所有权验证待搜索引擎处理。用法见 `docs/indexnow.md`。

### 2. Favicon 与 `og:image`（已完成）

实现前：生产 Worker 白名单 **没有** `/favicon.ico` 或分享图；Twitter card 是 `summary` 且无图。扩展图标在 `extension/icons/`，主视觉在 `assets/brand/kotoba-live-master.png`（生成说明见 `assets/brand/README.md`）。本机 `server/app.js` 有 `/favicon.ico` 分支，生产没有。

建议：

- 从主视觉导出 `favicon.ico`（16/32/48）以及 `apple-touch-icon`。
- 做一张约 1200×630 的 `og:image`（含产品名 Kotoba Live，不要塞站点品牌词）。
- 把文件放进云端静态资源构建，**加入 `cloud/worker.js` 白名单**。
- `pricing.html` / `policies.html` 增加 `link rel="icon"`、`og:image`、`twitter:image`；可把 Twitter card 升为 `summary_large_image`。
- 验收：`https://kotoba.uk/favicon.ico` 200；分享调试能拉到图；HTML 有对应 meta。

### 3. Cloudflare AI Crawl Control（已完成策略核对）

- 确认 Search = Allow，**不要**一键 Block AI bots。
- 与 `robots.txt` 的 `ai-input=yes, ai-train=no` 对齐：允许搜索与用户代理读取；GPTBot / ClaudeBot 属于训练用途，不与 OAI-SearchBot / Claude-SearchBot / PerplexityBot 混同。
- Wrangler token 改不了这项，必须登录 Cloudflare Dashboard（zone `kotoba.uk`）。
- 验收：结合 Verified Bot Category 与具体请求日志核对真实搜索/用户代理的访问；仅自定义 bot UA 返回 200 不算真实身份验收。最新核验结果见文末。

### 4. 可抓取英文页 + `hreflang`（已完成）

实现前：`html lang="zh-CN"`，英文靠 `ui-locale.js` 在浏览器里替换文案。爬虫和多数 LLM 抓到的是中文 HTML。`.crawl-en` 只是首页一段英文，不是独立 URL。

建议：

- 提供稳定英文 URL（例如 `/en` 或 `/en.html`），服务端或静态 HTML 默认 `lang="en"`，内容与中文页等价（产品、定价、安装、不解析视频文件）。
- 中英互加 `link rel="alternate" hreflang="zh-CN"` / `en` / `x-default`。canonical 各指自己或统一策略，不要中英抢同一 canonical。
- 用户语言切换可继续用现有选择器；不要让 SEO 英文页依赖 JS 才能读到正文。
- 加入 Worker 白名单、sitemap、`llms.txt` 链接。
- 验收：无 JS 的 curl 能读到完整英文产品说明；hreflang 成对；sitemap 含新 URL。

### 5. 独立 FAQ / 原理页（已完成，见 P2/P3 验收）

现状：安装步骤在首页 `<details id="install">`，计费问答在 `#rules`，法律与安装另在 `policies.html`。缺少可单独收录的「如何工作」页。

建议新增例如 `/how-it-works` 或 `/faq`（中英若做了第 4 项则成对）：

- 标签页音频如何采集、原声是否保留、是否解析视频文件
- 适用场景（课程、访谈、直播、浏览器内播放的日语）
- 目标语言、试用/计费要点（与 `llms.txt` 和定价页一致）
- 尚未上架 Chrome 商店时的 ZIP 安装

写入 sitemap 与 `llms.txt`。不要复制政策全文。验收：新 URL 200、有独立 title/description、出现在 sitemap。

### 6. Chrome 网上应用店（获客，独立发布线）

站点已写明尚未上架，下载仍是 `/downloads/kotoba-live.zip`。商店列表本身是安装入口和外链。

- 遵守 Chrome Web Store 政策；列表、截图、描述同样 **禁止** 具体站名/成人/盗版暗示。
- 上架后：更新首页/政策/`llms.txt`/JSON-LD 的 `downloadUrl` 或增加 `installUrl`，去掉过时的「仅 ZIP」说法。
- 本项不替代第 4、5 项，可并行。

### 7. 等数据后再做（现在不要反复操作）

- GSC Pages / Performance / Core Web Vitals：新属性需约一天才有数。
- 索引状态从 *Discovered* 变为 crawled/indexed 后再决定是否补内链，而不是连点 Request indexing。
- 外链、目录站、媒体投稿：当前公开 URL 很少，先把第 4、5 项做完再推。

## 明确不要做

- 隐藏关键词、为某站点做「隐身 SEO/GEO」。
- 给内测域名做 index。
- 把 `/pricing` 再写进 sitemap（与 `/` 重复）。
- 未加入 Worker 白名单就上新静态路径。
- 用 Wrangler 改 Zone DNS 或 AI Crawl Control（权限不够）。

## 部署与验证

```sh
npm test
npm run check
npm run cloud:test
node scripts/cloud-test.js --production
node scripts/cloud-assets.js --production
npx wrangler deploy --config wrangler.production.jsonc
```

密钥只用 Worker Secrets，不要打进 HTML 或扩展包。部署后至少 curl：`/`、`/robots.txt`、`/sitemap.xml`、`/llms.txt`，以及本次新增的公开路径。

## Codex 交接核对（2026-09-08）

- 已核对代码与 Git：SEO 基础端点及 canonical 重定向分别在 bb4fd33、8bf1eb7；本交接文件尚未提交。Google Search Console 操作状态依据本交接记录，未在本轮重新登录核验，也未重复申请收录。
- 上轮套餐更新漏改了 llms.txt 的硬编码价格，现改为直接读取 server/payment-catalog.js，并加入一次性月包及旧权益保留说明；有专门回归测试。首页 JSON-LD 已是新报价。
- AI 爬虫建议需按用途细分。GPTBot 用于潜在模型训练；OAI-SearchBot 用于 ChatGPT 搜索。若坚持允许搜索/引用但拒绝训练，不应笼统允许 GPTBot。参考 https://developers.openai.com/api/docs/bots 。本轮未更改 robots 或 Cloudflare 爬虫访问策略。
- Content-Signal 是用途声明，不等于技术上保证不会训练；自行设置 bot UA 请求返回 200 也不等于真实爬虫 IP 一定可访问。后续应结合机器人验证、边缘规则和访问日志核验。
- Bing、favicon/分享图、独立英文页、FAQ 与 Chrome 商店仍为待办，本轮仅接收交接并修复遗漏的价格同步。

价格说明同步修复已部署，版本 `f10eeffb-deac-45fc-80a6-e58d0ae0388c`；81 项测试及语法检查通过，线上 robots/sitemap/llms 返回 200，llms 与当前套餐配置生成内容一致。

## P1 实现（Bing 除外，2026-09-08）

- 品牌资产：web/brand/favicon.ico 包含 16/32/48 三个尺寸；favicon-32.png；180×180 apple-touch-icon.png；1200×630 social-card.png。分享图由 imagegen 基于现有品牌制作，原始图在 assets/brand/kotoba-live-social-master.png。技术缩放和格式封装保留原品牌，图中无价格或站点品牌词。
- scripts/localized-pages.js 使用 parse5 在构建时解析原 HTML，复用现有产品词典和套餐配置生成中文、英文首页及政策页。scripts/cloud-assets.js 两种模式均生成页面和品牌资源。生成后的源码直接含英文正文、安装步骤、价格与时长，无需执行 JS。
- 正式入口 /en 与 /en/policies.html；/en/、/en.html、/en/pricing 301 到 /en；内部政策文件别名归一到英文政策 URL。各页有自身 canonical 和互相对应的 zh-CN/en/x-default hreflang。新 URL 加入 Worker 白名单、sitemap、llms.txt。
- 全部公开 HTML 增加 favicon、Apple Touch Icon、og:image、Twitter summary_large_image 与图片尺寸、替代文字。生成时从套餐配置填入可见价格和 JSON-LD，避免价格单独维护。
- 页面语言由 URL 决定，不因浏览器语言或旧本地偏好把 /en 变成中文。下拉菜单切换跳转到对应 URL，保留查询参数与锚点；英文页内部导航保持英文。英文 Checkout 使用英文界面并返回 /en。插件原有语言偏好机制保留。
- robots.txt 默认允许抓取公开页，声明 search=yes、ai-input=yes、ai-train=no；排除 /api/ 和 /stream；单独 Disallow GPTBot、ClaudeBot。非正式发现端点与静态资源带 noindex, nofollow。
- 已通过登录的 Cloudflare Dashboard 保存并重新打开核对：新用途策略 Search=Allow、Agent=Allow、Training=Block；旧版 Block AI training bots=Block on all pages。AI Labyrinth、Bot Fight Mode、Hotlink Protection 均为关闭，未修改这些开关。Cloudflare 的新用途策略替换旧设置的日期以其控制台说明为准。
- 搜索用途允许是访问策略，不保证搜索引擎收录、大模型引用或所有第三方遵守训练声明；HTTP 自定义 UA 测试不代替真实爬虫 IP/日志验收。
- Bing、独立 FAQ/原理页、Chrome 商店发布仍未执行。未重复提交 Google 收录请求，现有 sitemap 地址不变。

### P1 正式部署验收

- 正式版本：`6e2766c5-7de8-4b55-b3fd-3d0771625f54`，2026-09-08 部署至 kotoba.uk / www.kotoba.uk。
- 85 项测试、语法检查、Wrangler dry-run、测试和正式配置的 workerd 集成检查通过。
- 四个公开页面返回 200，响应 HTML 与本地正式构建逐字一致；favicon、Apple Touch Icon、分享图片在线字节与本地文件一致。robots/sitemap/llms 返回 200，sitemap 包含四个规范页面。
- 英文桌面首屏和套餐卡片已截图检查；390px 窄屏 DOM 无横向溢出。浏览器中英文切换正确往返 `/en#plans` 与 `/#plans`，英文政策导航保持英文，账号加载完成后正常呈现登录区。
- `/en/`、`/en.html`、`/en/pricing`、`/policies.en.html` 及 HTTP/www 别名规范化已在线验证，查询参数保留。英文首页初始 HTML 已含真实报价、时长及英文正文，无需 JavaScript 才能抓取。
- 模拟 Googlebot、Bingbot、OAI-SearchBot 的本机请求返回 200；模拟 ChatGPT-User、Claude-User、Claude-SearchBot、PerplexityBot 返回 Cloudflare 403，正文为 `Your request was blocked.`；模拟 GPTBot 返回 200，但 robots 明确禁止其抓取。上述请求不来自各供应商真实爬虫 IP，不能据此确定真实爬虫的放行或阻断情况。Dashboard 的用途策略已保存和复核，真实访问效果仍需后续真实爬虫日志核验；未为伪造 UA 添加绕过安全规则。
- 本次未执行 Git commit/push。

### 真实 AI 爬虫核验（2026-09-08，GMT+8）

状态：**部分验证，当前搜索/用户代理的真实访问样本仍不足，不能标记全部通过。** 本轮只读取 Cloudflare Analytics / Events，未修改安全策略。

- AI Crawl Control / Metrics 的最近 24 小时快照：79 次请求，59 次允许（56 次 200、3 次 301），20 次失败（7 次 403、13 次 404）。免费版 UA 统计会包含此前模拟请求，不应将这个总数当作真实 AI 访问次数。
- Security Analytics 按 `Verified Bot Category` 筛选：`AI Search` = 0，`AI Assistant` = 0，`AI Crawler` = 20。页面说明数据基于 adaptive sampling；0 表示该查询未显示样本，不证明从未访问。
- 已验证真实样本：2026-09-08 15:42:54，`ClaudeBot/1.0`，源 IP `216.73.216.250`，GET `/pricing`；Cloudflare 标记 `Verified Bot Category: AI Crawler`、`Not mitigated`、`Cache status: Hit`。这些训练爬虫记录早于本轮抓取限制配置，不能用于确认当前放行或训练阻断效果。请求详情未显示明确 HTTP 状态码，不把 `Not mitigated` 擅自写成 200。
- 此前模拟 403 已定位到规则：19:05:20 的 `Claude-SearchBot`，源 IP `13.196.69.13`，GET `/en`，Ray `a37d7a3c9b673435`；命中 `Cloudflare Bot Management rules for all plans` / `Manage AI bots`（规则 `7bd01eeccb6b420fa0be30264603a5cb`），动作 Block。这是本机模拟请求，不能据此推断真实 Claude 搜索代理一定被拦，也不能将原因写成已证实的“伪造 UA 防护”。
- 后续验收条件：配置生效后的真实 OAI-SearchBot、Claude-SearchBot、PerplexityBot 或用户读取代理样本，核对身份、请求路径、响应/拦截详情；若真实搜索/用户代理被拦，再针对命中规则处理。当前未新增任何 UA 绕过规则，也未关闭训练抓取限制。
- 参考：Cloudflare GraphQL 文档区分可伪造的 userAgent 筛选与身份检测：https://developers.cloudflare.com/ai-crawl-control/reference/graphql-api/ 。

## P2 / P3 实施与验收（2026-09-08）

### 已部署和验证

- 生产版本：`0a530292-5b90-4160-bbc5-73f16565a054`。
- 中英文如何工作：`/how-it-works`、`/en/how-it-works`；中英文 16 项 FAQ：`/faq`、`/en/faq`。内容包括安装、账号连接、字幕设置、音频处理、计费、故障与能力边界。
- 首页导航和页脚接入新页面；新页 canonical、hreflang、Worker 白名单、别名 301、sitemap、llms.txt 已同步。页面原始 HTML 即可读取正文，价格与时长从套餐配置生成。
- 86 项测试及语法检查通过；新增页面的测试/正式 workerd 路由检查通过。最新生产的 8 个公开 HTML 均 200，去除 Cloudflare 注入的分析脚本后与本地构建一致；每页 3 个 hreflang；sitemap 含 8 个 URL。
- 新增 4 页在 1280px 和 390px 的线上浏览器检查无横向溢出、无页面 JavaScript 异常。已截图检查英文原理页和中文窄屏 FAQ；商店示例字幕的日文编码已核验。
- Google Search Console 已重新提交更新后的同一 sitemap URL，控制台显示 `Sitemap submitted successfully`。此前发现数 2 是旧快照，不代表新 8 页全部收录；Overview 仍在处理数据，没有重复点击 Request indexing。

### 性能与数据基线

正式 `/en` 使用 Lighthouse 13.0.1 默认移动端模拟各运行一次。原始 JSON：`output/lighthouse-en-before.json`、`output/lighthouse-en-after.json`。

| 指标 | 修改前 | 修改后 |
| --- | --- | --- |
| Performance | 99 | 99 |
| Accessibility | 96 | 100 |
| Best Practices | 92 | 100 |
| SEO | 92 | 92 |
| FCP / LCP | 1.7 秒 / 1.7 秒 | 1.1 秒 / 1.1 秒 |
| CLS / TBT | 0 / 0 ms | 0 / 0 ms |

- 修复低对比度辅助文字，`--muted` 改为 `#5d6b60`。
- 发现 Cloudflare 已注入的 Web Analytics 脚本被本站 CSP 拦截。仅补充其官方脚本域与采集域，保留其他 CSP 限制；后测无该控制台错误。隐私说明同步网站无 Cookie 流量/性能分析用途。这不代表已经有足够的真实访问或转化数据。
- SEO 扣分为 Lighthouse 不识别 `Content-Signal` 扩展指令；保留用户要求的允许搜索、拒绝训练用途声明，不为追求工具分数删除它。
- FCP/LCP 的两次差异包含网络波动，不将其归因于本次改动。上述为实验室数据，不是 Core Web Vitals 真实用户样本，也不是排名或大模型引用保证。
- 后续需有真实数据再看 GSC 展示/点击/查询/索引和 Cloudflare 页面访问、性能分布；当前没有创建后台定时监控。

### 已准备，尚未完成外部发布

- Chrome 商店开发者账号已由用户完成登录与注册付费。用户现已提供并授权使用公司文件，名称与公司邮寄地址已核对；Google 组织验证仍需可接收短信且允许公开的手机号，尚未完成身份验证或提交插件审核。
- 商店名称、简介、双语描述、权限用途、隐私声明和审核步骤见 `docs/chrome-web-store.md`；实际扩展 UI 生成的 3 张 1280×800 JPG、440×280 推广图及 128px 图标在 `assets/store/`。演示字幕和账户数据明确标注，未作为识别准确率证明。
- Product Hunt、AlternativeTo、中文社区草稿及带 UTM 的入口见 `docs/launch-kit.md`。这些是可发布材料，未创建外部平台发布记录或发送社区帖子；平台登录与具体发布仍待完成。
- Chrome 商店公开链接取得后，再替换官网和发现文档的 ZIP 安装主入口。商店审核、真实搜索数据及真实 AI 搜索爬虫访问仍有外部依赖，P2/P3 不标记全部完成。
- 本轮没有 Git commit/push；保留既有未提交定价和支付相关修改。

最后复核：正式配置 workerd 集成测试通过；FAQ 与原理页在真实线上浏览器中完成中英文往返切换，查询参数保持；官网 ZIP 与本地 0.2.0 安装包字节一致。剩余外部步骤为 Google 手机身份验证、商店条目提交/审核、推广渠道的实际发布及真实流量/爬虫样本积累。


## 后续内容与账户统计（2026-09-09）

正式部署版本：`dcec4126-8ec2-41dc-8ff0-46840d0ed4f1`。

### 本轮完成

- 搜索意图与竞争结果调研：`docs/search-content-plan.md`。保留原始官方/产品来源，不编造搜索量、难度或排名；没有购买关键词工具或广告。
- 字幕选择指南 `/subtitle-guide`、`/en/subtitle-guide`：按已有字幕、无字幕实时观看、需要可编辑文件等实际任务说明选择；首页导航和页脚接入。
- 原创试听示例 `/sample`、`/en/sample`：13.568 秒原创日语合成语音，中英文各一次实际识别与翻译。公开原文、未经润色的输出、测试日期和能力限制。中文首个译文 4.083 秒、英文 4.465 秒是开始发送音频后的时间，不是句尾到字幕显示的延迟；没有经过插件端到端链路。
- 新页面间有内链，Worker 白名单、canonical、hreflang、sitemap 和 llms.txt 同步，站点地图现含 12 个规范 URL。同一 sitemap 地址此前已提交 Google；本轮未重复请求收录，也不代表 12 页已收录。
- 管理员账户汇总接口 `/api/admin/funnel`：按首次观察来源聚合已验证账户、领取试用、净音频用量、取得付费额度及退款后保留付费额度的账户数。见 `docs/acquisition-report.md`。
- 来源统计不设置 Cookie、浏览器存储或访客 ID；只在登录后写入有限来源类别，尊重 GPC/DNT。来源与账户关联，隐私说明已更新。它不是完整访客漏斗，不代表可靠的新客归因或字幕成功率。

### 验收证据

- 87 项测试通过，语法检查通过；正式配置 workerd 普通账户 403 与管理员 200 两种分支均通过，未登录 401、非法来源 400。
- 线上 12 个 HTML 返回 200，去除 Cloudflare 分析脚本后与本地构建一致，每页 3 个 hreflang。音频、公开 JS、插件 ZIP 字节匹配；sitemap 12 个 URL；正式未登录统计接口与来源接口均 401/no-store。记录：`output/seo-next-http.json`。
- 新增中英文 4 页在 1280px/390px 浏览器检查无横向溢出、无页面 JS 异常；实际线上音频播放时间推进，时长 13.568 秒；中英文切换往返通过。记录：`output/seo-next-live-browser.log`、`output/seo-next-live-layout.json`。
- 管理员真实报表浏览器导航被客户端拦截（ERR_BLOCKED_BY_CLIENT），未取得生产真实汇总；不能把测试样例当作真实转化数据。生产未登录访问限制已独立验证。
- 本轮未执行 Git commit/push；没有发布社区消息、创建定时任务或处理用户暂缓的 Bing。

### 尚需外部条件

1. Chrome 商店审核：2026-09-09 已完成商业发布者短信验证和 support@kotoba.uk 邮箱验证，0.2.0 已上传并正式提交，后台显示 Pending review；已选择审核通过后自动发布。条目 ID `bgjpmnfpjjmldfhcggodmbpolgkplmih`。待审核通过且公开页面可访问后，再更新官网商店安装入口。上方 9 月 8 日的手机号阻塞记录为历史状态。
2. 真实 Google/Bing 收录、搜索展示与点击、真实 AI Search/Assistant 抓取样本：需要搜索引擎实际访问和数据积累，不能由模拟 UA 或 llms 文件保证。
3. 管理员真实统计读取：正常管理员登录并解决浏览器客户端阻止；未绕过认证。
4. 真实自然语音与完整插件链路评估：当前公开示例只有干净合成语音；后续需要有权使用的不同说话人、噪声、口音等素材，不能将单次样本宣传为普遍准确率。
5. 外部推广：发布材料已准备，但本轮没有代表用户发送社区消息；商店公开链接仍待审核。

## 后台实查（2026-09-09，约 09:20–09:35 GMT+8）

- GSC 首页 `https://kotoba.uk/` 已显示 **URL is on Google / Page is indexed**。上次抓取显示 Sep 8, 2026, 6:00:52 PM（控制台原样时间），Googlebot smartphone，抓取与索引均允许、Page fetch Successful；Google-selected canonical 为被检查的首页 URL。
- `/en` 为 **Discovered - currently not indexed**，没有历史抓取时间。执行一次 TEST LIVE URL，结果 **URL is available to Google / Page can be indexed**（控制台测试时间 Sep 9, 2026, 9:25 AM）。可抓取不等于已经收录，不作排名承诺。
- `/en/subtitle-guide` 为 **URL is unknown to Google**；未将这个抽查推断为所有新页面状态。
- sitemap 原有记录 Success，最后读取 Sep 8，发现 8 页。针对新增加的指南和样本双语页（当前 sitemap 共 12 页），本轮重新提交一次相同 sitemap URL，返回 **Sitemap submitted successfully**；未对首页重复 Request indexing。等待 Google 处理，不能把提交成功当作 12 页全部收录。
- GSC Overview 的 Performance 和 Indexing 汇总仍 Processing data，Experience 尚无数据。
- Cloudflare Security Analytics：最近 24 小时（GMT+8），分别按 Verified Bot Category=AI Search、AI Assistant 过滤，均 Total 0、无抽样日志。该数据基于 adaptive sampling，不证明从未访问；当前仍没有足够真实样本确认搜索/用户代理放行效果。本轮未更改安全规则。
- Cloudflare 设置页显示旧版 Block AI bots 将于 September 15 废弃，并提示混合用途爬虫届时默认被阻止。本轮未更改用户既定训练阻断策略；迁移后的真实搜索影响仍须按具体爬虫核验。
- 生产管理员汇总已成功读取（200/no-store）：在正常已登录的 kotoba.uk 页面发起同源只读请求即可。直接导航 JSON 接口仍报 ERR_BLOCKED_BY_CLIENT；不能据此判定服务端接口故障。未读取或导出登录凭证，也未放宽认证。详见 docs/acquisition-report.md。
- Web Analytics 已有生产采集数据：最近 24 小时 29 Page views、29 Visits，其中浏览器维度 ChromeHeadless 24、Chrome 4、ChromeMobile 1；明显含自动化测试，不代表 29 个真实独立用户。页面加载时间 813 ms，LCP P75 968 ms，INP 无数据；样本少且测试污染，不能当作成熟真实用户性能基线。
- 无生产代码改动、无部署、无 Git commit/push；Bing 仍暂缓，未发送外部推广消息或创建监控任务。

## Bing Webmaster Tools 接入（2026-09-09，约 13:00–13:15 GMT+8）

本节更新上方历史记录中的“Bing 暂缓”状态。

- 用户已登录 Bing，并在 Google 新权限确认时明确授权只读 Search Console 数据。仅选择并导入 `https://kotoba.uk/`，Bing 返回 **Site addition successful**；未添加其他站点、未修改 DNS。
- 导入列表显示 sitemap 数量为 0，因此手动提交一次 `https://kotoba.uk/sitemap.xml`。Bing 表格显示 **Submitted / Processing**，Known sitemaps 1，错误与警告均为 0；URLs discovered 暂为 0，不能把尚未处理视为已经解析成功。
- 提交前公开 HTTP 检查：sitemap 返回 200，包含 12 个规范 URL；12 页均返回 200、canonical 指向自身，未返回 X-Robots-Tag noindex。
- Bing 首页控制台提示数据和报表可能需要最多 48 小时出现；这是报表处理提示，不是页面必定在 48 小时内收录的承诺。
- 中文首页索引检查：**Discovered but not crawled**，发现日期 09 Sept 2026。一次 Live URL 测试显示 **URL can be indexed by Bing / No SEO/GEO issues found / 2 Markup types found**。实际索引尚未完成。
- 英文首页 `/en` 索引检查：**Not discovered**。一次 Live URL 测试显示 **URL can be indexed by Bing**，识别 2 类 markup，同时报 **Meta Description too long or too short**。线上 meta description 实测 230 个字符，控制台建议 25–160 个字符；后续缩短英文首页描述，本轮未改动线上文案。该抽查不代表其他所有页面的索引状态。
- URL Submission 批量提交 sitemap 中全部 12 个公开规范 URL，一次提交完成。后台逐条显示 **Today at 13:11**，**URLs submitted today 12**，当日剩余额度 88。未提交账户/API/带查询参数页面，未重复刷提交；请求被接受不等于完成抓取或收录。
- 本轮只做站点接入、抓取检查与提交。IndexNow 自动通知仍为可选待办，未创建 API key、修改生产代码、部署、创建定时监控或执行 Git commit/push。

## 摘要修正与 IndexNow 接入（2026-09-09，约 13:15–13:30 GMT+8）

正式部署版本：`ec60d7f0-f205-4946-b27c-97c8a892c9f9`。

### 已完成与验证

- 全站检查发现 3 个英文摘要偏长：`/en` 230 → 156 字符、`/en/how-it-works` 164 → 156 字符、`/en/subtitle-guide` 166 → 139 字符。同步构建出的 meta description 与 Open Graph；首页 Twitter description 同步。中文内容与套餐配置未改动。
- 所有 12 页本地和线上检查通过：HTTP 200、独立 title/description、自引用 canonical、语言标记、3 个有效 hreflang、可解析 JSON-LD、无 noindex；摘要长度均在本轮采用的 25–160 字符范围内。这是减少截断的编辑约束，不是排名保证；搜索引擎仍可能改写摘要。
- IndexNow 的验证文件仅在正式 Worker 精确路径响应，复用公开页面清单限制提交范围。发布后脚本默认预检，显式 `--submit` 才发送；线上 key 文件、sitemap、HTML 和 canonical 任一不满足即停止。
- 已配置 Worker Secret `INDEXNOW_KEY`，本机文件被 Git 忽略且权限为 0600；文档、回执不记录该值。见 `docs/indexnow.md`。
- 仅将本次更新的 3 个英文 URL 通知 IndexNow 一次，返回 **HTTP 202**（2026-09-09T05:23:31Z）。表示通知已接收、所有权验证待处理，尚不能确认最终验证、抓取或收录。没有再次提交全部 12 页，也没有自动重试。
- 91 项测试通过，JavaScript 语法检查通过；正式模式 workerd 集成验证包括 key 路由、错误 key/方法、认证、余额和翻译链路回归。原有重复词典键构建警告仍存在，与本轮 SEO 改动无关。
- 线上 `/health` 正式模式正常；robots/sitemap/llms 200，未登录管理员接口仍 401；下载 ZIP 与已提交商店的本地 0.2.0 包字节一致。未重打扩展包或重新提交商店审核。
- 英文首页真实浏览器加载完成，登录区显示邮件登录表单、Cloudflare 验证组件与未登录状态，无需为本轮 SEO 检查发送验证码。
- 部署后 Bing 英文首页 Live URL 复测（控制台 Today at 13:25）显示 **URL can be indexed by Bing / No SEO/GEO issues found / 2 Markup types found**，原描述长度提示已消除。Bing Index 状态现为 **Discovered but not crawled**，不能把实时测试通过当作已收录。
- 验收记录：`output/seo-metadata-local.json`、`output/seo-metadata-live.json`、`output/indexnow-2026-09-09.json`、`output/seo-indexnow-tests.log`、`output/seo-indexnow-cloud-test.log`、`output/seo-indexnow-deploy.log`。

### 当前后续顺序

| 事项 | 当前边界 / 下一步 |
| --- | --- |
| Bing / IndexNow 处理 | 等待已提交请求处理后复查 sitemap、验证和索引；不要短时间反复刷提交 |
| Chrome 商店安装入口 | 既有记录为 Pending review；审核通过且公开链接实际可访问后再替换 ZIP 主入口 |
| 真实 AI 搜索爬虫 | 累积可验证请求样本；模拟 UA 和实时测试不能替代自然爬虫日志 |
| Cloudflare 爬虫策略迁移 | 9 月 15 日旧设置迁移后核对具体搜索/用户代理，保留既定训练阻断策略 |
| 自然语音端到端案例 | 需有权使用的不同说话人、噪声和口音素材；现有合成样本不能宣称整体准确率 |
| 获客与内容迭代 | 有真实查询、点击和用户使用数据后更新页面；现有社区材料尚未发布，需要具体渠道的发布授权 |

本轮没有 Git commit/push，也没有创建定时监控或发送社区推广消息。
