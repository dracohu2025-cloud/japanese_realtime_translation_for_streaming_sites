# Kotoba Live 正式环境

正式域名为 https://kotoba.uk，运营主体为 DracoNova Inc。正式服务使用独立 Worker `kotoba-live`、Durable Object `production-v1` 和 `kotoba_billing_live` 账本；不会迁移内测账户、订单或余额。内测 Worker `kotoba-beta` 保留。

## 收款与账户

- Stripe 正式账户：`acct_1SOaKbGDmcxGUUz4`。
- 月度会员：USD 19.99，每个实际订阅周期 20 小时，不结转。
- 加时包：USD 9.99，10 小时，确认到账后 90 天有效。
- 试用：每账户一次 20 分钟，不自动转付费。
- 正式回调：`https://kotoba.uk/api/payments/webhook`，必须验证签名和 live 模式。
- 支付成功回调、主动对账和退款处理按账户串行；回调重发不重复发放时长。付款页面返回参数不会直接增加余额。
- 部分退款按原购买时长比例扣回；已使用时长不变成负余额。争议冻结对应订单，胜诉恢复未退款且未使用的时长。退款操作由运营人员在 Stripe 核对后处理，网站不自动退款。

登录采用 Better Auth 邮箱验证码及必要 Cookie。公开发送验证码必须通过 Turnstile，并受邮箱、来源和全局发送预算限制。插件连接码最长一小时有效，退出对应网页会话后失效。当前每账户一个翻译会话，部署配置最多 10 条连接，会话最长 60 分钟。

## 邮箱

`support@kotoba.uk` 是 Zoho 现有 `mailto@aigc.green` 用户的别名，显示名称 Kotoba Support；无需新增用户席位。Cloudflare 仅管理 DNS，MX 直接指向 Zoho，未启用 Cloudflare Email Routing。

Zoho 已验证 MX、SPF、DKIM；DMARC 初始使用 `p=none`。验证码由 Resend 使用已验证的 `login@aigc.green` 发出，回复地址为 `support@kotoba.uk`。这两个服务的角色不同：Resend 负责自动验证码，Zoho 负责客服收信和人工回复。

## 构建与部署

```sh
npm test
npm run check
npm run cloud:test
node scripts/cloud-test.js --production
node scripts/cloud-assets.js --production
node scripts/package-production.js
npx wrangler deploy --config wrangler.production.jsonc
```

正式扩展版本为 0.2.0，生成在 `dist/kotoba-live-0.2.0.zip`。安装说明为 `/policies.html#install`，公开下载为 `/downloads/kotoba-live.zip`。需要解压后在 Chrome 开发者模式加载；尚未在 Chrome 网上应用店发布。

密钥只放 Cloudflare Worker Secrets。本机忽略提交的 `.env.production-secrets.json` 是权限 0600 的备份，不可加入 Git、网页资源或扩展包。新增部署前可使用 `wrangler secret bulk` 安全导入；不要将密钥值拼进命令行或日志。

紧急关闭购买时将正式配置的 `PAYMENTS_ENABLED` 设为 `false` 后重新部署；登录、余额查询及试用仍可使用。此开关只关闭新的结账入口，不会取消已有 Stripe 订阅或停止其自动续订。

## 验证边界

2026-09-08 已验证正式域名 HTTPS、公开账户配置、真实验证码进入 Zoho 收件箱、登录后领取试用以及正式与测试账本隔离。正式 WebSocket 使用 12 秒合成静音验证：供应商确认处理 12000 ms，余额准确扣除 12 秒，连接跨过 10 秒仍正常；此项不代替日语识别质量或真实 Chrome 扩展交互测试。

两个正式 Checkout 页面已确认金额、周期、时长及 DracoNova Inc 收款主体；没有提交付款。付款、退款、争议、故障补时及乱序/并发回调有本机模拟测试，公开模式有 workerd 集成测试。真实扣款、续订及退款仍需真实交易记录验证，不能用测试回调代替。

正式扩展下载与本地包的 SHA-256 均为 `7ae663fc6bcb6eec1335ecc36db7fabda634d2ff5717ca6ed128978627be2e94`；检查包内未包含正式密钥或旧内测服务域名。本次上线版本为 `0e270710-94c9-4992-9993-9f712213478d`，`PAYMENTS_ENABLED=true`。

## 中文钱包月包

中文界面额外展示支付宝 / 微信支付专区，英文界面通过页面语言隐藏；语言仅控制展示，不作为支付鉴权。一次性月包（`monthpass`）现为 USD 19.99 / 20 小时，首次确认到账后 30 天有效，每笔购买分别记录到期日，不自动续费、不结转，不影响银行卡订阅。

当前正式价格为 `price_1UDM4CGDmcxGUUz4gzbr5XO7`（旧价格 `price_1UDLI7GDmcxGUUz4G9sHPuCi` 仅保留用于历史归账），配置项 `STRIPE_MONTHPASS_PRICE`；省略该配置时钱包购买按钮禁用，后端拒绝创建该套餐。月包只接受 `alipay` 或 `wechat_pay`；微信使用 `client=web`。原有会员和加时包仍使用银行卡。切换钱包会使旧的未支付收银台过期。

月度会员和一次性月包优先按到期先后扣时，之后为试用，再为按到期排序的加时包。支付成功必须验证账户、订单、商品、金额和实际支付状态；异步确认和重复通知仅发放一次，重发通知不延长有效期。已订阅 `checkout.session.async_payment_failed`，异步失败解除该收银台的待付款状态；退款沿用按比例扣回机制。

已核对 Stripe 后台支付宝和微信普通支付均为 Enabled；两个正式收银台显示 DracoNova Inc、US$9.99 和对应钱包。未提交真实付款，扫码完成支付及真实退款仍未验证。

本次月包部署版本：`afcb6aa5-dfb9-4a1b-a0d0-0b75009b99ef`。75 项单元测试及测试 / 正式两种 workerd 集成检查通过；线上已确认中文展示、英文隐藏，核验用的两个未付款收银台已主动关闭。

## 2026-09-08 套餐扩容 v2

新购会员与一次性月包为 USD 19.99 / 20 小时；加时包为 USD 9.99 / 10 小时。20 分钟试用、会员周期、月包 30 天及加时包 90 天有效期不变。Stripe 新建独立 v2 商品和价格，旧商品描述及现有订阅不修改。

正式配置 STRIPE_LEGACY_PRICES 按旧 Stripe Price ID 固定记录金额、时长、类型和有效期；仅用于旧订单到账、续费和退款归账。历史订阅仍为 USD 9.99 / 10 小时，旧月包为 USD 9.99 / 10 小时，旧加时包为 USD 4.99 / 5 小时。已发放余额不迁移、不翻倍。新购买只用当前价格，旧收银台不会被当作新报价复用；已打开的旧收银台付款仍按旧权益处理。未知价格或金额不匹配不发放时长。

本次正式部署版本：`c3ef2894-2aca-43aa-bd7d-97838cb38398`。当前 Stripe 价格：

| 类型 | Price ID | USD / 时长 |
| --- | --- | --- |
| 月度订阅 | price_1UDM4AGDmcxGUUz417DkQrNc | 19.99 / 20 小时 |
| 加时包 | price_1UDM4BGDmcxGUUz4qYAylFGo | 9.99 / 10 小时 |
| 一次性月包 | price_1UDM4CGDmcxGUUz4gzbr5XO7 | 19.99 / 20 小时 |

80 项单元测试、语法检查、测试与正式模式 workerd 集成检查通过。正式 /api/plans、中英文浏览器页面及钱包区语言显隐已验证；会员收银台显示 $19.99/月与 20 小时，新加时包、支付宝月包和微信月包的正式 Checkout 金额、商品描述、支付方式由 Stripe API 核对。首页、条款、翻译词典与下载 ZIP 已逐字节比对线上和本机构建结果。本次未提交实际付款或触发自动续费，新价格真实扣款仍待用户验证。测试模式的新价格也已写入 wrangler.jsonc，未重新部署 beta Worker。
