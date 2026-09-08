# Kotoba Live 正式环境

正式域名为 https://kotoba.uk，运营主体为 DracoNova Inc。正式服务使用独立 Worker `kotoba-live`、Durable Object `production-v1` 和 `kotoba_billing_live` 账本；不会迁移内测账户、订单或余额。内测 Worker `kotoba-beta` 保留。

## 收款与账户

- Stripe 正式账户：`acct_1SOaKbGDmcxGUUz4`。
- 月度会员：USD 9.99，每个实际订阅周期 10 小时，不结转。
- 加时包：USD 4.99，5 小时，确认到账后 90 天有效。
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
