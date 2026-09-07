# 通用日语实时翻译插件：定位边界与供应商成本评估

调研日期：2026-09-07。假定首个目标语言为简体中文。

状态：官方公开资料调研和算术测算；未调用付费推理 API，未做音频质量测试，未确认付款意愿，未部署或提交商店审核。供应商价格不构成其对特定内容场景的使用许可。

## 1. 定位与上架判断

真正面向多种普通日语内容的翻译插件，以及日语口语、方言、低音量、背景音乐、多人交谈、断句和字幕稳定性等通用能力，可以作为独立产品验证。判断重点是实际功能、主要用途和如实披露，而不只是名称。

Chrome 官方说明：以提供露骨内容访问或增强色情网站为主要目的的扩展不允许上架。官方也单独提及某些成人导向网站集成需要标记 Mature；这不意味着标记 Mature 就能豁免主要用途的限制。对某一具体版本的最终认定只能来自实际审核。[Chrome 违规排查文档](https://developer.chrome.com/docs/webstore/troubleshooting)

可支持的后续实现范围是通用日语翻译工具，并使用有授权的普通素材进行测试。本调研不提供色情内容专用调优、隐藏用途或规避审核方案。

## 2. 比较口径

- 音频输入以单声道、连续处理 60 分钟为基准；按连接时长收费的服务单独注明。
- 美元与人民币保留原币种，不使用未核实汇率混算。
- 不以免费额度、年付承诺、模型训练换折扣或企业议价作为长期基线。
- ASR 是识别原文，不自动等于日语到中文翻译；TTS 是生成语音，不包含前端识别和翻译。
- token 报价换算的每小时费用均是估算。语言、语速、上下文、思考输出、重试、重新连接和重复处理都会影响实际账单。

## 3. 实时语音识别候选

| 供应商 / 模型 | 原始公开价格 | 换算 / 输入小时 | 判断和限制 |
| --- | --- | --- | --- |
| Soniox 实时 STT | 音频输入 $2/M token；文本输入、输出各 $4/M token | 官方参考约 $0.12 | 已查到日语及翻译能力；原文和译文都要纳入输出 token 测算 |
| Speechmatics Standard / Enhanced | $0.24 / $0.43 每小时 | $0.24 / $0.43 | 日语识别可选；翻译语言对需要独立检查 |
| Deepgram Nova-3 单语 | 促销 $0.0048/min；原价 $0.0077/min | $0.288；原价 $0.462 | 文档列出日语；热词、说话人分离等可能另收费 |
| Deepgram Nova-3 多语 | 促销 $0.0058/min；原价 $0.0092/min | $0.348；原价 $0.552 | 日英混说候选；不能默认比指定日语更准确 |
| 阿里云 Qwen-Audio-3.0-ASR-Flash-Streaming，北京 | ¥0.00033/sec | ¥1.188 | 最新语音识别文档列出日语、热词和上下文；无翻译费用包含在内 |
| 同模型，新加坡 | ¥0.00066/sec | ¥2.376 | 同一模型地域价格不同；账号、部署地域和延迟需实测 |
| ElevenLabs Scribe v2 Realtime | $0.39/hr | $0.39 | 日语候选；不能把文件识别 Scribe 的 $0.22/hr 用到本行 |
| AssemblyAI Whisper Streaming | $0.30/连接小时 | $0.30 | 文档称 99+ 语言；需完成日语端点确认后再进入实测；低价 Universal 系列列出的 6 种语言不含日语 |
| Gemini 3.5 Transcribe Live | 官方按输入音频、输出文本 token 给出约 $0.009/min | 约 $0.54 | 作为价格参照；具体日语支持和区域可用性本轮未逐项验证 |
| Google Cloud STT V2 Standard | 首档 $0.016/min | $0.96 | 应选支持日语及流式识别的具体模型、地域；不能使用 Dynamic Batch 价替代 |
| OpenAI GPT-Live-Transcribe | 官方估算 $0.017/min | 约 $1.02 | 当前实时指南主推；本轮未确认完整日语语言表；指南说明不返回词级时间戳、说话人标签或置信度 |
| AWS Transcribe，美东弗吉尼亚首档 | $0.024/min | $1.44 | 官方语言表确认日语 streaming；其他地区另核价 |
| Azure Speech | 抓取价格页显示 $- 占位符 | 待核实 | 不将竞品网站引用的 Azure 价格当作已核实官方价格 |

价格和能力来源：

- Soniox：[价格](https://soniox.com/pricing)、[日语](https://soniox.com/platform/japanese)、[原文加翻译输出](https://soniox.com/docs/translation/stt-translation)。
- Speechmatics：[价格](https://www.speechmatics.com/pricing)、[语言及翻译语言对](https://docs.speechmatics.com/speech-to-text/languages)。
- Deepgram：[价格](https://deepgram.com/pricing)、[模型及语言](https://developers.deepgram.com/docs/models-languages-overview)。
- 阿里云：[价格](https://help.aliyun.com/zh/model-studio/model-pricing)、[识别模型](https://help.aliyun.com/zh/model-studio/asr-model)、[模型更新](https://help.aliyun.com/zh/model-studio/newly-released-models)。
- ElevenLabs：[API 价格](https://elevenlabs.io/pricing/api)、[实时识别日语页面](https://elevenlabs.io/ja/realtime-speech-to-text)。
- AssemblyAI：[模型与价格](https://www.assemblyai.com/docs/faq/how-can-i-use-universal-1)、[连接时长计费](https://www.assemblyai.com/docs/faq/how-does-universal-streaming-session-based-pricing-work)。
- Google：[Gemini 价格](https://ai.google.dev/gemini-api/docs/pricing)、[Cloud STT 价格](https://cloud.google.com/speech-to-text/pricing)、[Chirp 3](https://docs.cloud.google.com/speech-to-text/v2/docs/chirp-model)。
- OpenAI：[价格](https://developers.openai.com/api/docs/pricing)、[实时识别指南](https://developers.openai.com/api/docs/guides/realtime-transcription)。
- AWS：[价格](https://aws.amazon.com/transcribe/pricing/)、[语言](https://docs.aws.amazon.com/transcribe/latest/dg/supported-languages.html)。
- Azure：[官方价格页](https://azure.microsoft.com/en-us/pricing/details/speech/)。

### 不能直接混入实时排名的低价选项

Groq Whisper Large V3 Turbo 为 $0.04/音频小时，Whisper Large V3 为 $0.111/音频小时；这是文件识别接口，最短计费时长是每次请求 10 秒。需要分片才能模拟近实时，且必须另测等待、边界丢字和重复文本。[Groq 官方文档](https://console.groq.com/docs/speech-to-text)

例如假设每 5 秒提交一次不重叠片段，一小时 720 次，每次至少计费 10 秒，Turbo 的识别账单约 $0.08/观看小时；每 2 秒一次则约 $0.20。这个计算仅解释计费差异，不说明这些分片方案的识别质量或可用性。

OpenAI 价格表列出 gpt-4o-mini-transcribe 约 $0.003/min，即 $0.18/小时；文件转录的低价不能直接充当当前 GPT-Live-Transcribe 实时服务价格。批处理、文件接口的流式输出，以及持续输入音频的实时会话需要区分。[OpenAI 价格](https://developers.openai.com/api/docs/pricing)

## 4. 翻译成本

文本翻译使用统一假设：每输入音频小时，合计发送 100,000 输入 token（已经包括反复发送的指令、上下文），产生 15,000 输出 token；不使用缓存或 Batch 折扣，不启用搜索。以下是算术示例，未经日语质量验证。

| 翻译方案 | 官方单价 | 按上述假设 / 音频小时 |
| --- | --- | --- |
| Gemini 2.5 Flash-Lite | 输入 $0.10/M；输出 $0.40/M | $0.0160 |
| Gemini 3.1 Flash-Lite | 输入 $0.25/M；输出 $1.50/M | $0.0475 |
| Gemini 3.5 Flash-Lite | 输入 $0.30/M；输出 $2.50/M | $0.0675 |

更换模型后要重新统计 token；不能假定日语字符、中文字符与 token 一一对应。思考 token 若产生，同样要计入付费输出。[Gemini 官方价格](https://ai.google.dev/gemini-api/docs/pricing)

Google Cloud Translation NMT 的首个常规付费档是 $20/百万输入字符。假设每小时发送 20,000 日文字符，则翻译成本为 $0.40/小时；免费额度和超大规模折扣未计入。这个字符场景并非与上面的 token 场景精确等价。[Cloud Translation 价格](https://cloud.google.com/products/translate/pricing)

Soniox 同一调用能输出原文及译文。根据计费表，若每小时使用 30,000 音频输入 token、15,000 原文输出 token，另有 15,000 译文输出 token，且无额外上下文，则合计 $0.18/小时。公开页 FAQ 的“翻译 included/no extra cost”与 token 表述存在容易误解的地方：本测算保守地将译文算入输出，最终以账单和供应商确认结果为准，不能承诺双语固定 $0.12/小时。[Soniox 价格](https://soniox.com/pricing)

Speechmatics 的附加翻译公开标价为 $0.65/小时，但其语言文档当前列出的主路径是英语到其他语言、其他语言到英语，未列出日语直接到中文。因此不能简单加上该价就认定已经获得日中翻译；本项目的测算使用独立文本翻译服务。[价格](https://www.speechmatics.com/pricing)、[语言对](https://docs.speechmatics.com/speech-to-text/languages)

## 5. 语音输出和一体化翻译

中文 TTS 的字符计费与音频时长计费不能直接横向等同。字符方案按 10,000 个待朗读字符计算；音频方案按实际生成 1 小时计算，不等于观看 1 小时。

| 服务 | 公开单价 | 示例费用 |
| --- | --- | --- |
| Qwen3-TTS-Flash-Realtime，北京 | ¥1/万字符 | ¥1/万字符 |
| 同模型，新加坡 | ¥0.954101/万字符 | ¥0.954101/万字符 |
| Google Neural2 | $16/M 字符 | $0.16/万字符；需另核目标中文音色及接口能力 |
| Google Chirp 3 HD | $30/M 字符 | $0.30/万字符；具体音色和流式能力需确认 |
| ElevenLabs Flash / Turbo | $0.05/千字符 | $0.50/万字符 |
| Soniox TTS | 官方估算约 $0.70/生成音频小时 | 30 分钟输出约 $0.35 |

来源：[阿里云](https://help.aliyun.com/zh/model-studio/model-pricing)、[Google TTS](https://cloud.google.com/text-to-speech/pricing)、[ElevenLabs](https://elevenlabs.io/pricing/api)、[Soniox](https://soniox.com/pricing)。这些是 API 单价，账号方案最低消费、未用完额度、声音授权与实际音质需要在采购前核实。

一体化路线也可做对照：OpenAI gpt-realtime-translate 官方估算 $0.034/min，即约 $2.04/小时；Gemini 3.5 Live Translate Preview 输入约 $0.0053/min、输出约 $0.0315/min，输入与输出都持续 60 分钟时约 $2.208。后者按输入和输出分别计费，不能把这一合计当作只取决于输入时长的固定费率。两者本轮仅完成价格核查，未确认账号可用性、完整语言表或端到端质量。[OpenAI](https://developers.openai.com/api/docs/pricing)、[Gemini](https://ai.google.dev/gemini-api/docs/pricing)

## 6. 通用字幕产品的完整成本示例

以下均为预算情景，不是实测账单。基础设施统一暂留 $0.03/观看小时作为占位；这不是云厂商报价，也没有证明低流量时能够覆盖固定开销。未计获客、人工、税、支付费、退款和免费试用消耗。

| 情景 | 计算方式 / 小时 | 20 小时成本 | 50 小时成本 |
| --- | --- | --- | --- |
| Soniox 双语 | $0.18 + $0.03 = $0.21 | $4.20 | $10.50 |
| Deepgram 单语促销 + Gemini 3.1 Flash-Lite | $0.288 + $0.0475 + $0.03 = $0.3655 | $7.31 | $18.275 |
| Deepgram 单语原价 + 同一翻译 | $0.462 + $0.0475 + $0.03 = $0.5395 | $10.79 | $26.975 |
| Speechmatics Enhanced + 同一翻译 | $0.43 + $0.0475 + $0.03 = $0.5075 | $10.15 | $25.375 |
| Soniox 双语加 TTS，输出时长为观看时长 50% | $0.18 + $0.03 + $0.70 × 0.5 = $0.56 | $11.20 | $28.00 |

如只考察 $9.99/月、每月 20 小时的假设套餐：Soniox 双语情景扣除上述成本后剩 $5.79，约占收入 58%；Speechmatics Enhanced 情景则已超过月费。价格尚不能说明哪条路线质量合格，也不能把剩余比例当作净利润。

计算公式：

`每月服务成本 = 识别计费时长 × 识别单价 + 翻译输入/输出消耗 + 语音生成消耗 + 实际基础设施成本`

不要预设静音节省：AssemblyAI 按 WebSocket 打开时间计费，暂停发送音频不自动停止账单；其他服务也应按其实际计费字段核对，而不是统一按“有人说话的秒数”估算。[AssemblyAI 计费说明](https://www.assemblyai.com/docs/faq/how-does-universal-streaming-session-based-pricing-work)

## 7. 建议的验证顺序

第一组：Soniox、Deepgram Nova-3、Qwen-Audio-3.0-ASR-Flash-Streaming；Speechmatics Enhanced 作为质量对照，ElevenLabs 作为额外对照。这个顺序基于价格、已确认的日语能力和路线差异，不是准确率排名。

仅使用有授权的普通日语课程、访谈和直播样本。以相同播放速度、输入格式及噪声条件比较：

1. 日文字符错误率，并固定标点、数字、假名和汉字的归一化规则；同时保留未经归一化的人工检查。
2. 中文意思是否正确，是否漏掉否定、人物关系、专有名词，是否添加原文没有的内容。
3. 从原句结束到稳定中文字幕出现的 P50/P95 延迟；临时字出现速度单独记录。
4. 非语音段误出字幕、字幕反复改写，以及重叠说话时的表现。
5. 连续播放、暂停、跳转、断网重连后的同步性与真实账单。

字幕语义和成本达标后再对比语音输出，新增译音积压、音画偏移和长时间可听性指标。最终供应商选择必须同时依赖质量、延迟、账单和数据处理条款；本轮尚不能确认任一供应商已经满足生产上线条件。

自托管或端侧可以另做候选，但不应标成“零成本”：前者要计 GPU、并发利用率、闲置与维护，后者要测用户设备、耗电、模型下载和浏览器兼容性。本轮没有足够实测给出每小时成本或优于云 API 的结论。
