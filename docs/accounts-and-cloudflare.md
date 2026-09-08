# Kotoba 登录与 Cloudflare

核实日期：2026-09-07。已完成 [Cloudflare 线上封闭内测部署](cloud-beta.md)，Stripe 仍为测试模式。下文记录此前本机账户内测的方案与验证边界；最新线上状态以部署文档为准。首版登录采用邮箱验证码，Google 暂缓；发信配置见 [邮箱登录](email-login.md)。

## 方案选择

- Cloudflare Access 提供应用访问控制，可接入 Google 等身份提供方，也有邮箱一次性 PIN。它主要解决访问哪些应用的问题，不能直接替代 Kotoba 的用户、订阅、消费额度和设备授权逻辑。建议将来用于管理后台。
- Cloudflare Workers 可以承载应用认证代码；D1 可以保存账户数据。Better Auth 提供 Google OAuth、邮箱 OTP 和会话管理，并支持 D1。是否迁移托管，与登录供应商选择分开决定。
- Turnstile 是防机器人验证，可保护验证码发送和试用领取，不是用户账号系统。
- 首版暂按 Google + 邮箱验证码准备；先用 Better Auth 1.7.3 + 现有 Node 服务 + 本机 SQLite 验证闭环。保留现有 WebSocket 音频协议，计费规则不绑定到 Cloudflare。

来源：[Access 应用类型](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/choose-application-type/)、[Access 邮箱 PIN](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)、[Workers Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)、[Turnstile](https://developers.cloudflare.com/turnstile/)、[Better Auth 数据库](https://better-auth.com/docs/concepts/database)、[Google](https://better-auth.com/docs/authentication/google)、[邮箱 OTP](https://better-auth.com/docs/plugins/email-otp)。

## 运行与使用

本机需要 Node 22.13+（本次验证为 22.22.1）、项目依赖及有效 Stripe CLI 测试登录。Node 22 的内置 SQLite 仍提示实验状态，不能据此认定生产运行时已选定。

```sh
npm run account:test
```

打开 [账户内测](http://127.0.0.1:8791/pricing)：

1. 输入 `demo@kotoba.test` 等 `.test` 邮箱，获取验证码。验证码直接显示在本机页面；不会发送邮件，也不证明真实邮箱所有权。
2. 填入验证码完成登录，领取一次性 20 分钟，或使用 Stripe 测试卡购买。每个账户的客户、订单与额度独立。
3. 点击“获取插件连接码”，在扩展设置填入页面给出的服务地址 `ws://127.0.0.1:8791/stream` 和连接码。
4. 开始翻译后，方案页每 5 秒刷新剩余时长。连接码最长有效 1 小时，退出登录后失效；正在进行的连接最多 5 秒内停止。
5. 原有 8787 个人密钥模式和 8790 共用支付演示继续保留。只有连接 8791 账户服务才扣减该账户的测试时长。

运行数据和会话密钥在被 Git 忽略的 `output/account-test/`。不会自动把旧共用测试余额分配给任何新用户。账户、额度和插件连接码哈希均持久化，重启后未到期且所属网页会话有效的连接码仍可使用；首次从内存凭据版本升级后需重新生成一次。账号模式拒绝旧共用配对码，不向用户提供供应商 Usage Logs 查询。

## 本地计量语义

- 整数采样数计量：16,000 样本 = 1 秒，PCM16 每样本 2 字节。余额展示取整到秒，账本保留采样精度。
- 只有本机上游 WebSocket 写入队列接受的音频才保存扣时。同步拒绝或抛错回滚当前帧。进入上游队列不等于 Soniox 已确认处理，也不等于字幕成功交付。
- 月度 → 试用 → 最早到期加时包；无效期内额度不参与扣减。连接、等待和停止采集后的时间不扣。播放静音仍会产生音频帧，仍扣时。
- 每账户一路会话；服务端串行处理音频帧。余额不足一帧时只转发剩余样本，归零即停，不自动购买。
- 内部同会话、同序号重试不重复转发或扣时。当前客户端不会在断线后自动重发历史音频；用户重新播放或手动重启采集属于新的音频。
- 最近 100 次会话保存累计样本、最后帧序号和起止时间，不保存音频或字幕内容。

## 上线前仍需完成

1. Google OAuth client ID/secret、正式回调域名；选定邮件服务并配置发送域名。当前本机测试收件箱只接受 `.test` 邮箱，禁止与真实 Google/邮件认证混用；Google 入口在未配置时隐藏。
2. 将正式登录与数据库部署到选定基础设施。这里的账户账本只支持单 Node 进程；并发锁在内存，不能直接开多个副本。SQLite CAS 可检测其他进程写入，但不是分布式消费锁。
3. 支付和音频写入跨系统无法成为一个事务：若在转发后、SQLite 提交前进程崩溃，可能少计一帧。生产版需要会话租约、持久化用量与恢复/对账方案。支付查询占用账户事务时也可能使音频等待，云端版本需要缩小事务范围。
4. Soniox 异步拒绝、网络丢包或字幕无法交付后的补时策略；退款/争议权益调整；历史订阅事件乱序；真实邮件防滥用与试用防刷；完整监控告警。
5. 扩展与桌面端的正式网页登录/自动配对体验。当前仅提供手动连接码测试，并未打包成新的商店版本。

本地测试闭环不代表正式用户登录、Google OAuth、邮件投递、云端扣费或退款流程已上线。

## 验证结果

- 全部 38 项自动化测试通过，JavaScript 与扩展清单检查通过。
- 实际浏览器完成 .test 验证码登录、领取 20 分钟和生成账户连接码；桌面与 390px 窄屏页面均已检查，无横向溢出。
- 通过 8791 与 Soniox 建立连接，发送 3,200 字节静音测试音频，余额由 1200 秒变为 1199.9 秒。该验证证明本机转发/扣时路径，不证明 Soniox 已最终处理或日语字幕准确度。
- 支付用户路由由签名 Webhook 集成测试覆盖；真实 Stripe 测试卡付款沿用首轮 8790 验证结果。本轮没有新增真实卡扣款。
