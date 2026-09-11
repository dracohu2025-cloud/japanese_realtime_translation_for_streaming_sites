import Foundation
import CoreGraphics
let values = CommandLine.arguments.dropFirst().compactMap(Double.init)
let start = CGPoint(x: values[0], y: values[1])
func post(_ type: CGEventType, _ point: CGPoint) { CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: point, mouseButton: .left)?.post(tap: .cghidEventTap) }
post(.mouseMoved, start)
Thread.sleep(forTimeInterval: 0.15)
post(.leftMouseDown, start)
if values.count == 4 {
    for step in 1...45 { let progress = Double(step)/45; post(.leftMouseDragged, CGPoint(x: start.x+(values[2]-start.x)*progress,y:start.y+(values[3]-start.y)*progress)); Thread.sleep(forTimeInterval:0.02) }
    post(.leftMouseUp, CGPoint(x:values[2],y:values[3]))
} else { Thread.sleep(forTimeInterval:0.1); post(.leftMouseUp,start) }
