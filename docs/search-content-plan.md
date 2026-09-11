# 搜索需求与内容计划 — 2026-09-09

## 调研边界与结论

本轮使用中英文公开搜索结果和产品官方页面判断意图、竞争与内容空缺，没有连接关键词付费数据库。因此不提供未经验证的月搜索量、关键词难度、市场份额或转化率。搜索结果会受时间、地区、语言影响。

“日语音频实时翻译”已有直接竞品，不能以“只有 Kotoba 能处理无字幕视频”作为定位。已有字幕翻译工具也可能提供音频识别能力，不能把竞品永久归类为“只能翻译已有字幕”。更合适的工作方向是减少安装和连接摩擦、清楚说明实际能力、展示可复核样本，并用真实使用与付款数据验证定位。

## 观察来源

以下为厂商或开发者自己的公开声明，本轮未逐一购买或实测，不能作为质量比较结论。

- Japanese Audio to English Subtitles 的 Chrome 商店条目：直接使用 Japanese audio / live English subtitles 意图，采用用户自带 API key 的模式。https://chromewebstore.google.com/detail/japanese-audio-to-english/gcalcegpalnjdfepciahcnnejffgjfok
- Mimisubs 官方首页：直接定位日语视频的实时英文字幕。https://mimisubs.com/
- Immersive Translate 官方视频页：包含无字幕视频的 AI 字幕入口。https://app.immersivetranslate.com/video/
- LiveSubtitle 官方首页：定位标签页实时双语字幕及按时长付费。https://www.livesubtitle.online/
- Google 官方 AI 搜索说明：基础 SEO、可收录页面与有帮助的内容仍适用；无需专用 AI 文件或特殊 schema。https://developers.google.com/search/docs/appearance/ai-features

这些第三方网站仅用于内部调研；本轮新公开页面不含具体视频网站或竞品站名。

## 意图到页面的映射

| 查询方向 | 用户想解决的问题 | 页面与本轮动作 |
| --- | --- | --- |
| 日语实时字幕插件 / Japanese live subtitles Chrome | 寻找可用工具、价格与安装入口 | 现有首页和英文首页；保持真实价格与 Chrome 安装说明 |
| 日语视频没有字幕怎么翻译 / translate Japanese video without subtitles | 确定是否需要音频识别、有哪些选择 | 新建 /subtitle-guide 与 /en/subtitle-guide |
| 日语课程或访谈实时翻译 | 边看边理解；核对术语和重要信息 | 在选择指南中提供独立场景段落，暂不复制为大量相似落地页 |
| 日语字幕翻译准确吗 / Japanese live subtitle accuracy | 看实际效果、了解限制 | 新建 /sample 与 /en/sample，提供原创音频及单次实际输出 |
| 日语字幕不显示 / 连接码失效 / Chrome 实时翻译怎么用 | 排障与安装 | 现有 FAQ 和如何工作页；用实际支持问题持续更新 |
| 字幕翻译与音频实时翻译的区别 | 选择方法、避免为不需要的能力付费 | 选择指南提供四种情况对照，推荐先检查已有字幕 |

## 样本说明

- 原创文本约 13.568 秒；使用标准合成声音，无真人声音克隆。输入与最终返回文本在 web/demo/sample.json，试听音频在 web/demo/japanese-study.wav。
- 中英文各一次实际流式识别/翻译请求。中文首译文 4.083 秒、英文 4.465 秒，计时起点为发送首帧，不能称为句末到字幕显示延迟。
- 测试绕过 Chrome 采集、Kotoba 中继与界面渲染。无噪声、无重叠讲话、无自然口音集合，不构成产品整体准确率或端到端性能基准。
- 中文较生硬的语序原样展示，日文“十分”到“10分”的规范化也说明，不通过润色掩盖输出。
- 合成与识别均使用已有 Soniox 账户：TTS tts-rt-v2 / Adrian，STT stt-rt-v5。原始记录 output/original-demo/results.json；重跑脚本 scripts/run-demo-check.mjs 需要通过环境变量提供密钥，执行会消耗供应商额度。总识别音频约 27.136 秒，实际费用以账单为准。
- 服务条款与协议来源：https://soniox.com/policies/terms-of-service 、https://soniox.com/docs/tts/rest-api/generate-speech 、https://soniox.com/docs/api-reference/stt/websocket-api 。

## 数据出现后再决定

以 GSC 的实际查询与落地页表现为依据，先看目标查询是否有展示、是否被索引、用户点击后是否使用产品。不要仅因页面没有排名就批量生产同义词页面。只有出现明显不同的用户意图和足够原创内容时，才拆出单独的课程/访谈/直播教程。

Chrome 商店上架后再集中推广。Product Hunt、AlternativeTo 和社区材料已在 launch-kit.md，尚未实际发布。2026-09-09 用户恢复 Bing 配置并授权 Google Search Console 导入：Kotoba 站点验证已完成，sitemap 和 12 页抓取请求已提交；后续已部署 IndexNow，3 个本次更新页面的通知返回 202，所有权验证与索引等待搜索引擎处理。详见 seo-geo.md、indexnow.md。本轮未购买关键词工具、付费外链或广告。
