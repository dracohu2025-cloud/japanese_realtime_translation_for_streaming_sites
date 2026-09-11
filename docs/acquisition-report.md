# 账户来源与用量快照

用途：先建立基于真实账户与账本的运营统计，避免把访问和按钮点击当作付款转化。

## 如何查看

使用配置在 METRICS_ADMIN_EMAILS 中的管理员邮箱在官网正常完成验证码登录，然后访问 https://kotoba.uk/api/admin/funnel 。当前允许的管理员为项目所有者邮箱；未登录返回 401，普通用户返回 403。响应为 no-store JSON，仅含按来源汇总的数据和口径，不含邮箱、用户 ID、订单 ID、银行卡或字幕内容。

## 口径

- verifiedAccounts：已验证邮箱的账户数。
- trialClaimedAccounts：账本已记录领取试用的账户数。
- accountsWithNetAudioUsage：账本中有补偿后净音频用量的账户数。不是“第一句成功字幕”，也不是字幕准确性的证明。
- accountsWithPaidGrant：至少取得一次正金额付费额度的账户数，来源于现有支付确认账本；不按收银台回跳计算。
- accountsWithRetainedPaidGrant：其中至少一笔付费额度未被全额退款或暂停的账户。已过期的历史购买仍计入，不代表现在有余额。
- netAudioHours：账本净音频用量，不是供应商成本或收入。

来源为登录后第一次观察到的有限类别；只接受 direct/google/bing/chatgpt/claude/perplexity/producthunt/alternativeto/community/referral/unknown。先写入后不被后续请求覆盖。账户尚未有记录时归为 unattributed。

## 实际限制

- 浏览器只使用当前页面的 UTM source 或 referrer 主机分类，不设置 Cookie、sessionStorage、localStorage 或访客指纹；完整 URL、搜索词、medium/campaign 不保存。
- 来源来自客户端，可以被伪造，不能用于计费、权限、反作弊或财务归属。
- 已有账户也可能在上线后首次观察到来源；因此这是“首次观察来源”，不是可靠的新客首次获客归因。
- 站内跨页进入账号页时来源可能丢失并归为 unknown；无 referrer 不等于用户一定手工输入网址。Google 国家域等未匹配的搜索域会归为 referral。
- 浏览器启用 Global Privacy Control 或 Do Not Track 时不提交来源；隐私说明已同步。
- 各阶段并非严格依次发生，试用可跳过直接付费。结果按账户而非自然人计数。
- 没有唯一访客、下载、真实安装、首句字幕或转化耗时统计，不能据此报告完整“访问→安装→付费”转化率。它是第一阶段账户快照。
- 目前读取全时段账本，最多 10,000 个已验证账户，超过上限明确失败而不返回不完整总数；规模增长后再按真实需求做分页/预聚合。

## 数据与安全

新增独立 kotoba_acquisition 表，仅含账户 ID、来源类别、首次观察时间；不修改支付或认证表结构。来源记录与账户关联，随账户保留，删除账户资料时须一并删除该行。接口使用现有登录、同源验证、请求体上限及服务端管理员白名单。统计提交失败不阻止网站登录或翻译。

核验包括来源首次写入、非法来源拒绝、持久化、退款口径、报表无个人资料，以及 workerd 中未登录/普通账户访问拦截。生产真实数值需管理员已登录会话查看，不用测试数据替代真实用户表现。


2026-09-09 验收：正式配置 workerd 已分别覆盖普通账户 403、管理员 200（不含邮箱）、未登录 401；正式站点未登录接口返回 401/no-store。部署版本 dcec4126-8ec2-41dc-8ff0-46840d0ed4f1。真实管理员浏览器导航被客户端阻止，尚未读取生产汇总，不报告未经取得的真实转化数据。

### 2026-09-09 后续生产实查

在正常登录管理员的官网页面，通过同源 GET 请求 `/api/admin/funnel` 成功取得 HTTP 200、Cache-Control: no-store。直接导航到 JSON 接口仍出现 ERR_BLOCKED_BY_CLIENT，直接导航失败的具体浏览器原因未确定；服务端汇总和现有会话认证可正常工作。没有导出 Cookie、绕过鉴权或修改权限。

本次全时段快照：

| 首次观察来源 | 已验证账户 | 已领试用 | 有净音频用量 | 有付费额度 | 保留付费额度 | 净音频小时 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| unattributed | 1 | 1 | 1 | 0 | 0 | 0.0066667 |
| direct | 1 | 0 | 1 | 1 | 1 | 0.0307778 |

合计 2 个账户、1 个领取试用、2 个有净用量、1 个取得且保留付费额度。包含此前开发者手动测试，不能把 1/2 宣传为自然流量付费转化率。

网站 PV/访问次数另看 Cloudflare Web Analytics，不与这份账户汇总混用。入口：
https://dash.cloudflare.com/678302f2d4c832a5582c776b397eed2a/kotoba.uk/analytics/web/overview/page-views

Web Analytics 的 Visits 是访问次数，不是去重 UV。HTTP Traffic 另有 Unique Visitors，但该后台包含爬虫与其他请求，不能直接视为真人数。官方口径：https://developers.cloudflare.com/web-analytics/data-metrics/high-level-metrics/ 、https://developers.cloudflare.com/analytics/account-and-zone-analytics/zone-analytics/ 。

本轮后台最近 24 小时快照：Web Analytics 29 Page views / 29 Visits（其中 ChromeHeadless 24 次页面浏览）；HTTP Traffic 85 Unique Visitors / 2.63k Requests。HTTP Traffic 的 Help 明确 Unique Visitors 按请求网站内容的独立 IP 地址计算。两套指标采集方式不同，不合并计算人均浏览或转化率；85 不等于 85 个真人。

## 宣传片与安装入口汇总（2026-09-09）

管理员登录后访问 `/api/admin/marketing`，可查看最近 90 个 UTC 日、按语言分组的事件计数。与 `/api/admin/funnel` 的账户快照分别展示，不直接相除计算转化率。

- `video_play`：视频实际触发 playing 后记录，不在展开或点击播放按钮时提前计入。
- `video_complete`：触发 ended 后记录；拖动到末尾也可能触发，不代表完整观看。
- `download_click`：点击下载安装包入口，不代表下载完成或已安装。
- `install_guide_click`：点击安装指南入口，不代表已安装。

每种事件在同一次页面加载、同一语言内只计一次；刷新后可再次计数，不等于 UV。匿名请求不携带账户 Cookie；不保存访客 ID、完整 URL、播放内容或邮箱，不关联账户。遵从 GPC/DNT。事件可被伪造，机器人、手动测试也可能计入，不能用于计费或营销效果承诺。

服务端严格限制事件与语言枚举、256 字节请求体和同源 POST；安全限流使用现有带密钥 IP 摘要，窗口 60 秒，每 IP 最多 30 次请求。汇总只含日期、语言、事件、次数，单项每天最多 1,000,000。过期汇总在下一次写入或读取报表时清理。独立 SQLite 汇总表，不改账户、支付与额度表。

官网默认折叠宣传片；展开才请求约 30 KB 封面，点击播放才加载对应语言约 4–5 MB 的 MP4。视频不自动播放，关闭区域时暂停。资源使用版本化 URL 和长期缓存。

本次验收：93 项单元测试通过；正式配置 workerd 分别验证管理员与普通账户权限、同源拒绝、DNT、非法字段、并发累加和实例重建后持久化。浏览器验证首次零媒体请求、实际播放、折叠暂停、同页去重、DNT 不上报以及 390px 窄屏无横向溢出。部署版本 `71577cce-64c0-4ab1-9cb7-e16ded3ce86e`。

生产浏览器确认中英文 MP4 返回 video/mp4，完整 SHA-256 与本地一致，Range 请求返回 206/1024 字节；账户接口 200，未登录统计报表 401，非法事件 400。播放验收启用了测试浏览器 DNT，没有向生产汇总写入播放测试事件。未读取管理员生产汇总，不报告实际播放/点击次数。
