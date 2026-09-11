import Foundation
import ScreenCaptureKit
import AVFoundation
import AppKit

final class RecorderDelegate: NSObject, SCRecordingOutputDelegate {
    var finished = false
    var failed = false
    func recordingOutputDidStartRecording(_ recordingOutput: SCRecordingOutput) { print("RECORDING_STARTED"); fflush(stdout) }
    func recordingOutput(_ recordingOutput: SCRecordingOutput, didFailWithError error: Error) { print("RECORDING_FAILED: \(error)"); failed = true; finished = true }
    func recordingOutputDidFinishRecording(_ recordingOutput: SCRecordingOutput) { finished = true; print("RECORDING_FINISHED") }
}

@main struct Record {
    static func main() async throws {
        _ = NSApplication.shared
        let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)
        guard let window = content.windows.first(where: { $0.owningApplication?.bundleIdentifier == "com.google.Chrome" && ($0.title ?? "").contains("日语听力工作室") }) else { fatalError("Demo Chrome window not found") }
        print("CAPTURE_WINDOW: \(window.windowID) \(window.frame)")
        let filter = SCContentFilter(desktopIndependentWindow: window)
        let config = SCStreamConfiguration()
        config.width = Int(window.frame.width * 2)
        config.height = Int(window.frame.height * 2)
        config.minimumFrameInterval = CMTime(value: 1, timescale: 30)
        config.showsCursor = true
        config.includeChildWindows = true
        config.ignoreShadowsSingleWindow = true
        config.capturesAudio = true
        config.captureMicrophone = false
        config.sampleRate = 48000
        config.channelCount = 2
        let stream = SCStream(filter: filter, configuration: config, delegate: nil)
        let outputConfig = SCRecordingOutputConfiguration()
        outputConfig.outputURL = URL(fileURLWithPath: CommandLine.arguments[1])
        outputConfig.outputFileType = .mp4
        outputConfig.videoCodecType = .h264
        let delegate = RecorderDelegate()
        let output = SCRecordingOutput(configuration: outputConfig, delegate: delegate)
        try stream.addRecordingOutput(output)
        try await stream.startCapture()
        let seconds = UInt64(CommandLine.arguments[2]) ?? 45
        try await Task.sleep(nanoseconds: seconds * 1_000_000_000)
        try await stream.stopCapture()
        for _ in 0..<100 { if delegate.finished { break }; try await Task.sleep(nanoseconds: 100_000_000) }
        guard delegate.finished && !delegate.failed else { fatalError("Recording did not finish successfully") }
    }
}
