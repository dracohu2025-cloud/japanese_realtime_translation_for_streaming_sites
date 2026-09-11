# IndexNow 更新通知

用途：在公开页面更新并完成生产验证后，通知参与 IndexNow 的搜索引擎。它不是 Google Search Console 的替代，也不承诺抓取、收录、排名或 AI 引用。

## 当前实现

- Worker 的 `discovery()` 仅在正式环境响应精确的 `/<INDEXNOW_KEY>.txt` 验证路径。这个文件按协议需公开可读，但不链接到导航或 sitemap。
- 验证值放在 Cloudflare Worker Secret `INDEXNOW_KEY`，本机副本在已被 Git 忽略的 `.env.indexnow`（权限 0600）。这是站点所有权验证值，不是 Cloudflare、Bing 账户或语音供应商的访问密钥。不要复制到提交记录、截图、公共日志或代码仓库。
- `scripts/indexnow.js` 复用 `cloud/seo.js` 的公开页面清单，校验线上 sitemap、验证文件、HTML、noindex 和自引用 canonical。只允许明确指定已上线页面路径，不接受外站、查询参数、账户接口或重定向地址。
- 默认只预检；只有 `--submit` 会发送一次 POST。没有定时任务、页面访问触发器或自动重试，不会在每次部署时重提全部页面。
- 当前面向新增和更新的公开页面；删除页面的通知尚未实现，因为此入口要求页面返回 200 并在 sitemap 中。

## 发布后使用

先完成部署和线上内容校验，再明确列出本次发生变化的页面：

```sh
node --env-file=".env.indexnow" "scripts/indexnow.js" /en /en/how-it-works /en/subtitle-guide
node --env-file=".env.indexnow" "scripts/indexnow.js" --submit /en /en/how-it-works /en/subtitle-guide
```

不要对未变化的页面反复运行 `--submit`。本机需要执行者持有上述文件；其他机器需单独安全提供相同验证值。

- **200**：搜索引擎已接收 URL 通知；不代表抓取或收录成功。
- **202**：通知已接收，所有权验证待处理；不要立即循环重试。
- **403 / 422**：核查验证文件与路径范围，先修复再提交。
- **429**：停止提交并检查是否重复通知。
- 网络超时属于结果未知；先查控制台再决定是否重试，不要假定提交失败。

官方说明：[IndexNow 协议](https://www.indexnow.org/documentation)、[Bing 接入指南](https://www.bing.com/indexnow/getstarted)。
