# Kotoba Live marketing video

第一版：英文宣传文案，日语音频演示，16:9 横版，32 秒，1920 × 1080，30 fps。

## 成片与预览

- 成片：`renders/kotoba-live-en-1080p.mp4`
- 分镜预览：`snapshots/contact-sheet-1.jpg`、`snapshots/contact-sheet-2.jpg`
- 可编辑动画：`index.html`
- 创意说明：`BRIEF.md`
- 分镜与节奏：`STORYBOARD.md`

## 内容

1. Keep the voice. Follow the meaning.
2. 日语学习音频与英文字幕对照。
3. 可移动字幕、调整字幕框、选择语言。
4. kotoba.uk / Try 20 minutes free。

字幕出现时间经过剪辑编排，画面已标注 “Illustrative subtitle timing”，不作为识别延迟测试。第三幕使用项目已有的真实字幕界面截图，示例文本和移动轨迹用于说明功能。

## 素材来源

- 品牌图标：项目 `assets/brand/kotoba-live-master.png`，未修改。
- 字幕界面：项目 `assets/store/captions.jpg`，通过 CSS 裁切展示。
- 日语音频：项目 `web/demo/japanese-study.wav`，已有合成语音样本。
- 字幕内容：项目 `web/demo/sample.json`。
- 原创配乐：`create-music.py` 本地合成的钢琴音色与柔和铺底，无第三方音乐或付费生成调用。
- 字体：HyperFrames 渲染器加载的 Inter / EB Garamond，日文字形使用系统回退字体。

## 编辑与重新生成

在此目录执行：

    npm run dev
    npm run check
    npm run render -- --quality high --output renders/kotoba-live-en-1080p.mp4

HyperFrames 固定版本为 0.8.33。首次运行需要网络下载工具、动画库与字体。
配乐生成脚本需要 Python 3 和 numpy；视频渲染直接使用已附带的 WAV，无须重新生成。

此交付仅为本地宣传片，未上传官网或公开发布。
