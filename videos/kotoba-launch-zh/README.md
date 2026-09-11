# Kotoba Live 日语 → 中文宣传片

32 秒、1920 × 1080、30 fps；简体中文宣传文案和译文，保留日语原声与英文版的原创配乐。

## 文件

- 成片：`renders/kotoba-live-ja-zh-1080p.mp4`
- 可编辑动画：`index.html`
- 分镜：`STORYBOARD.md`
- 分镜预览：`snapshots/contact-sheet-1.jpg`、`snapshots/contact-sheet-2.jpg`

## 素材与演示

品牌图标和音轨复用 `../kotoba-launch/assets` 的原有素材。
三组中文字幕按日语音频翻译，出现时间经过编排，并在视频中标注为演示。
第三幕参考 `extension/content.js` 的样式，以 HTML 制作中文控件与示例字幕；画面标注「字幕界面示意」，不是实时录屏。
中文标题使用本机宋体（Songti SC），渲染时需要对应字体；其余中文使用系统字体。

## 重新生成

    npm run check
    npm run render -- --quality high --output renders/kotoba-live-ja-zh-1080p.mp4

HyperFrames 版本：0.8.33。需要网络加载工具及字体资源。

仅本地交付，未部署或公开发布。
