// 搜索意图不同于安装说明：帮助用户先选择合适的字幕处理方式。
export function subtitleGuide(locale) {
  return locale === 'en' ? {
    title: 'How to translate Japanese video when there are no subtitles',
    description: 'Compare caption translation, live audio subtitles, and subtitle files. Choose a workflow for Japanese lessons, interviews, and livestreams.',
    intro: 'Start by checking what the video already provides. A subtitle track, an audio-only livestream, and a file you want to edit need different workflows.',
    headings: ['Your situation', 'A useful starting point'],
    choices: [
      ['There are accurate captions in your language', 'Use the player’s captions first. You may not need another tool.'],
      ['There are Japanese captions, but no translation', 'Try translating the existing caption track. Recognition is already done, although the original captions can still contain errors.'],
      ['There are no usable captions and you want to watch now', 'Try live speech recognition and translation from the playing audio. Expect processing delay and occasional revisions.'],
      ['You need a finished, editable subtitle file', 'Choose a transcription and subtitle-editing workflow that supports file export and timing review.'],
    ],
    sections: [
      ['Check for an existing subtitle track first', 'Open the player’s caption or language settings. Text drawn into the video image is not necessarily an available subtitle track. Existing captions can preserve timing and terminology better than a fresh recognition pass, especially when they were reviewed by a person.'],
      ['What changes when there are no subtitles?', 'A live audio translator must first recognize the Japanese speech, then translate it, then display the result. Recognition errors can carry into the translation. This is why a clean interview and a noisy recording can produce very different results even with the same tool.'],
      ['For a Japanese lesson or interview', 'Start with a short section containing clear speech. Keep the Japanese original visible if you want to compare unfamiliar words. Pause or replay important parts and check names, dates, numbers, and specialized terms against the source. Live captions are a viewing aid, not a reviewed transcript.'],
      ['For a livestream', 'There is no complete future transcript to translate in advance. Expect unfinished phrases to change as the speaker continues. Overlapping voices and background music can make speaker labels and wording less reliable. If following the stream requires perfect timing or exact instructions, live subtitles alone may not be sufficient.'],
      ['Try Kotoba with the content you actually watch', 'Kotoba Live captures the selected desktop Chrome tab after you start translation and keeps the original sound playing. Install the extension, connect your account, select a translation language, and start playback. Move and resize the overlay to keep it away from important parts of the picture. The free trial lets you check your own player, audio, and network before buying time.'],
      ['Check these three things during the trial', 'Readability: can you comfortably follow the subtitle box? Compatibility: does it work in your player’s usual view and full-screen mode? Meaning: do the subtitles preserve important details in the sections you understand? Try a quiet section and a more difficult one. A polished example cannot predict performance for every recording.'],
      ['Understand time usage and the product boundary', 'Sending audio for live processing uses your translation time, including silence in playback and replaying the same passage. Stop translation when finished. Kotoba currently focuses on live text subtitles; do not choose it for promised offline processing, verified speaker identity, translated dubbing, or a guaranteed downloadable subtitle file.'],
    ],
  } : {
    title: '日语视频没有字幕，应该怎么翻译？',
    description: '分清已有字幕翻译、无字幕音频实时翻译和字幕文件处理，按日语课程、访谈与直播场景选择适合的方法。',
    intro: '先检查视频已经提供了什么。可用字幕轨道、只有声音的直播，以及需要后期编辑的视频文件，适合不同的处理方式。',
    headings: ['你遇到的情况', '可以先尝试的方法'],
    choices: [
      ['已有准确的中文字幕', '先使用播放器字幕，可能不需要额外工具。'],
      ['有日文字幕，但没有译文', '尝试翻译已有字幕轨道，省去重新识别声音的步骤；原字幕本身仍可能有错。'],
      ['没有可用字幕，希望边播边看懂', '尝试从正在播放的声音生成实时翻译字幕，接受一定延迟和文字修订。'],
      ['需要最终可编辑的字幕文件', '选择支持文件导出、时间轴校对的转写和字幕编辑流程。'],
    ],
    sections: [
      ['先找播放器的字幕或语言设置', '检查有没有可以选择的字幕轨道。直接印在视频画面上的文字，不一定是能读取的字幕轨道。经过人工校对的原字幕，可能比重新识别声音更能保留正确的时间和术语。'],
      ['没有字幕时，多了哪一步？', '实时音频翻译需要先识别日语，再翻译，最后显示结果。识别错误可能继续传到译文中。因此，即使使用同一个工具，清晰访谈和嘈杂录音的结果也可能差别很大。'],
      ['看日语课程或访谈', '先挑选一小段声音清晰的内容。需要对照生词时保留日文原文，遇到重要信息可以暂停或重听，并核对人名、日期、数字和专业术语。实时字幕是观看辅助，不等于经过人工审核的完整记录。'],
      ['看正在进行的直播', '直播没有完整的后文可供提前翻译。随着讲话继续，未完成的短句可能发生修订。多人同时说话和背景音乐也会降低说话人编号与措辞的可靠性。如果内容需要极其准确的时机或指令，仅靠实时字幕可能不够。'],
      ['用你实际想看的内容试用 Kotoba', 'Kotoba Live 在你开启翻译后采集电脑端 Chrome 的当前标签页声音，并保留原声。安装插件、连接账户、选择目标语言，再播放内容。可以拖动和调整字幕框大小，避开画面中的重点。先利用免费试用检查自己的播放器、声音和网络，再决定是否购买时长。'],
      ['试用时重点检查三件事', '可读性：能否舒服地跟上字幕？兼容性：播放器的普通模式和全屏模式能否正常使用？含义：在你能听懂的片段里，字幕是否保留了关键细节？建议同时尝试安静片段和较难的片段，单个漂亮示例无法预测所有录音的效果。'],
      ['了解时长消耗和产品边界', '发送音频进行实时处理会消耗翻译时长，包括播放中的静音和重复播放同一段内容。结束观看后请停止翻译。Kotoba 目前专注实时文字字幕，不承诺离线处理、真实身份识别、翻译配音或可下载的字幕文件。'],
    ],
  };
}
