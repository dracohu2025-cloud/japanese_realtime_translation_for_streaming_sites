import AppKit
let output = URL(fileURLWithPath: CommandLine.arguments[1])
let labels = ["01  选择中文，开启翻译", "02  播放日语，读懂内容", "03  原声保留，中文字幕实时呈现"]
for (index, label) in labels.enumerated() {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:1920,pixelsHigh:1080,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:1920*4,bitsPerPixel:32)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep:bitmap)
    NSColor.clear.setFill()
    NSRect(x:0,y:0,width:1920,height:1080).fill(using:.copy)
    let dark = NSColor(srgbRed:32/255,green:62/255,blue:53/255,alpha:1)
    (label as NSString).draw(at:NSPoint(x:100,y:1016),withAttributes:[.font:NSFont(name:"PingFangSC-Medium",size:27) ?? .systemFont(ofSize:27),.foregroundColor:dark])
    ("Chrome 实机录屏 · 原创合成日语音频 · 字幕原速生成" as NSString).draw(at:NSPoint(x:100,y:7),withAttributes:[.font:NSFont(name:"PingFangSC-Regular",size:16) ?? .systemFont(ofSize:16),.foregroundColor:NSColor(srgbRed:101/255,green:121/255,blue:109/255,alpha:1)])
    NSGraphicsContext.restoreGraphicsState()
    try bitmap.representation(using:.png,properties:[:])!.write(to:output.appendingPathComponent("label-\(index).png"))
}
