# Kotoba Live 图标

深青绿色底、暖白色对话气泡、三根声波线，避免字母在工具栏中辨识度不足的问题。

使用内置 imagegen 生成 `kotoba-live-master.png`；通过 macOS `sips -z SIZE SIZE` 导出 `extension/icons/icon-SIZE.png`，尺寸为 16、32、48、128。插件清单的 `icons` 和 `action.default_icon` 复用同组 PNG，原始大图不进入扩展安装包。

## 生成提示词

Create one polished production-ready square Chrome extension app icon for Kotoba Live, a Japanese live speech translation / subtitle tool. Icon only, no mockup, no lettering, no K, no typography, no presentation border. Minimal premium Japanese modernist aesthetic. Full square canvas 1024x1024 filled edge to edge with a solid very dark teal #123E3B background (square corners; no outer padding). Center one large warm ivory #F7F4E9 speech balloon silhouette with smoothly rounded corners and a short beautifully integrated speech tail pointing lower left. Within the ivory balloon, three dark teal vertical thick capsule bars of unequal heights form an elegant voice waveform (short, tall, medium). Strong negative space, exceptionally simple geometry, balanced optical centering, crisp flat vector-like shapes, no shadow, no texture, no gradients, no tiny decorative dots, no complex illustration. Balloon occupies approximately 72% of canvas width and 65% of height including tail, vertically centered. Must be beautifully legible as a 16px toolbar favicon. Return just the single icon, not a sheet of options.

## 网站分享资产（2026-09-08）

新增 kotoba-live-social-master.png，使用 imagegen 参考现有标志生成暖白与深青绿色分享卡，文案为 Kotoba Live / Japanese audio. / Live subtitles. / kotoba.uk。web/brand/social-card.png 是其 1200×630 网页版本；不包含价格以减少过期信息。favicon.ico 将已有 16/32/48 PNG 封装为多尺寸 ICO；Apple Touch Icon 由品牌原图缩放至 180×180。网站资源由 scripts/cloud-assets.js 复制，不引入生成服务运行时依赖。
