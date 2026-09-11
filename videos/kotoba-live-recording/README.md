# Kotoba Live 中文实机录屏素材

本片使用真实 Google Chrome、已安装的 Kotoba 插件和实际云端翻译。日语素材来自项目已有的原创文稿与合成语音，未使用第三方影视片段。

## 素材与真实性

- `capture/take-final.mp4`：ScreenCaptureKit 原始窗口录制，包含真实系统音频、插件弹窗与实际生成的字幕。
- `capture/events.json`：实际操作时间记录。
- `capture/audio-check.json`：录音与原始日语音频的波形相关性检查。
- `assets/japanese-study-padded.wav`：原始音频前加 1.5 秒静音、末尾加 20 秒静音，方便开始翻译和演示操作；日语语音本身未变速、未改写。
- `demo.html`：仅用于本地录制的原创听力演示页，无预置译文，也不注入字幕。

## 成片范围

32 秒、1920×1080、30 fps。片头和片尾复用已有中文品牌视频。中间连续实录使用原始视频 2.5–27 秒，保留原声与真实字幕延迟，不加速、不插入预写译文。顶部操作说明是后期编辑文字。

本版聚焦开启插件与生成中文字幕。拖动、调整大小等录制尝试未通过视觉验收，不纳入成片，也不宣称已经展示这些功能。

使用 macOS ScreenCaptureKit 原生录制和 FFmpeg 剪辑。没有替换官网视频，没有部署或提交代码。

## 复现

演示页可使用 `python3 -m http.server 8806 --bind 127.0.0.1 --directory videos/kotoba-live-recording` 启动。

录制脚本依赖本机已有屏幕录制、辅助功能权限及已连接的 Chrome 插件。`capture-flow.py` 包含这次特定窗口位置和按钮的自动化，运行前必须重新检查实际窗口位置，不能直接用于其他桌面布局。成片剪辑使用 `edit.py`，无需连接翻译服务。
