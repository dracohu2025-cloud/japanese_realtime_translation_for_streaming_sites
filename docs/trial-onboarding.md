# 免费试用自动到账

2026-09-10：已部署到 kotoba.uk，Cloudflare 版本 `067f0028-35e5-4655-bdcd-5ff1776585ac`。

- 邮箱 OTP 登录成功且 emailVerified 为真后，服务端尝试发放一次性 1200 秒试用。
- 复用账户账本 trialClaimed 和 trial grant；已领取账户重登不重复加时，不重置已使用时长或付费权益。以前未领取的账户在下次邮箱登录时也可自动领取，不批量修改存量账本。
- Cloudflare 自动与手动领取共用每 IP 每 24 小时最多三次的限制，检查在发放事务内部执行。
- 登录响应仅在实际成功发放时返回 trialGranted；前端显示绿色「20 分钟免费试用已到账」状态提示，并从账本重新查询余额。
- 发放失败保留登录会话，返回 trialPending，提示稍后手动重试；不伪报到账。
- 网页账户和插件读取同一账本，因此不需要更新插件即可读取自动发放的时长。

验证：账户与支付测试、重复登录/付费权益保护/限额失败重试测试、中英文页面测试、JavaScript 检查、Cloudflare workerd 正式配置集成测试（包括自动到账、三次名额、手动入口不能绕过限额）。

截图：`output/trial-preview/first-login-zh.png`。来自独立本地测试账户 first-login@kotoba.test，实际走 Better Auth OTP 和内存 SQLite 账本；使用正式站点构建的页面。无真实邮件、付款或生产账户余额变更，不冒充生产新用户截图。
