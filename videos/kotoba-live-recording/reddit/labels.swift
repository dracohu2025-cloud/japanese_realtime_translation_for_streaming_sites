import AppKit
let output = URL(fileURLWithPath: CommandLine.arguments[1])
let labels = ["01  Choose a target language and start", "02  Play Japanese audio", "03  Read live captions while keeping the original voice"]
for (index, label) in labels.enumerated() {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:1920,pixelsHigh:1080,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:1920*4,bitsPerPixel:32)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep:bitmap)
    NSColor.clear.setFill()
    NSRect(x:0,y:0,width:1920,height:1080).fill(using:.copy)
    let dark = NSColor(srgbRed:32/255,green:62/255,blue:53/255,alpha:1)
    (label as NSString).draw(at:NSPoint(x:100,y:1016),withAttributes:[.font:NSFont(name:"PingFangSC-Medium",size:27) ?? .systemFont(ofSize:27),.foregroundColor:dark])
    ("Real Chrome recording | Japanese to Chinese shown | Original synthetic audio | Original speed" as NSString).draw(at:NSPoint(x:100,y:7),withAttributes:[.font:NSFont(name:"PingFangSC-Regular",size:16) ?? .systemFont(ofSize:16),.foregroundColor:NSColor(srgbRed:101/255,green:121/255,blue:109/255,alpha:1)])
    NSGraphicsContext.restoreGraphicsState()
    try bitmap.representation(using:.png,properties:[:])!.write(to:output.appendingPathComponent("label-\(index).png"))
}
