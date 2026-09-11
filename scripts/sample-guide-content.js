import sample from '../web/demo/sample.json' with { type: 'json' };
export function sampleGuide(locale) {
  const en = locale === 'en', run = sample.runs.find(r => r.language === (en ? 'en' : 'zh'));
  return {
    title: en ? 'Listen to a Japanese sample and read the translation' : '听一段日语，看看本次翻译结果',
    description: en ? 'An original synthetic Japanese speech sample with the actual transcription and translation from a single test. Listen, compare, and understand the limits.' : '试听原创合成日语样本，对照一次实际测试返回的日文转写与中文翻译，并了解该示例的测试范围和限制。',
    intro: en ? 'A small, inspectable example. The audio below is synthetic speech reading our own script. The result is from one recorded test, not a promise of accuracy for every video.' : '一个可以试听和对照的小示例。下方音频用合成声音朗读原创文本；结果来自一次实际记录，不代表所有视频的准确率。',
    audioLabel: en ? 'Play the original synthetic Japanese sample' : '播放原创合成日语样本',
    audioNote: en ? '13.568 seconds · Synthetic voice · No background noise or overlapping speakers · Playback here uses no translation time.' : '13.568 秒 · 合成声音 · 无背景噪声或多人重叠 · 在这里试听不消耗翻译时长。',
    sections: [
      [en ? 'The original Japanese script' : '原始日语文本', sample.script, 'ja'],
      [en ? 'The Japanese transcription returned by the test' : '本次返回的日文转写', run.original, 'ja'],
      [en ? 'The translation returned by the test' : '本次返回的译文', run.translation],
      [en ? 'What you can observe' : '可以观察到什么', en ? 'The transcription uses digits for “ten minutes” and changes punctuation. The English translation retains the main ideas: listen to material you enjoy for ten minutes a day, pause at unfamiliar words, and listen again. This short example does not establish an overall accuracy rate.' : '转写将“十分”写作“10分”，并调整了标点。中文保留了每天听喜欢的内容、遇到生词暂停重听的主要意思，但“也很重要的是持续听”较生硬。这里保留原始输出，没有为了展示而润色；不能据此计算总体准确率。'],
      [en ? 'How this example was tested' : '这次测试是怎么做的', en ? 'Recorded on 9 September 2026 (Asia/Shanghai). The 13.568-second sample was streamed in real time to the speech recognition and translation service currently used by Kotoba, once for English and once for Chinese. It bypassed Chrome audio capture, Kotoba cloud relay, and the on-screen subtitle renderer. This is a service sample, not an end-to-end extension benchmark.' : '测试日期为 2026 年 9 月 9 日（北京时间）。将 13.568 秒样本按正常播放速度发送给 Kotoba 当前使用的识别与翻译服务，中英文各运行一次。测试没有经过 Chrome 音频采集、Kotoba 云端中继或页面字幕渲染，因此它是服务样本，不是插件端到端基准。'],
      [en ? 'About the timing' : '关于时间', en ? `The first English translation arrived ${(run.firstTranslationMs/1000).toFixed(3)} seconds after the first audio frame was sent. This is not the delay from the end of a spoken sentence to a visible subtitle. A short clean synthetic clip and a single request cannot predict everyday latency.` : `本次中文首个译文在开始发送音频 ${(run.firstTranslationMs/1000).toFixed(3)} 秒后返回。这不是“说完一句话到字幕显示”的延迟。干净的短合成音频和单次请求，不能预测日常使用的延迟。`],
      [en ? 'Try your own viewing conditions' : '再试试你实际观看的内容', en ? 'Use the free trial with the lessons or interviews you actually watch. Check a quiet passage and a difficult one, try the player mode you normally use, and compare important details. Noise, accents, overlapping voices and unstable connections can change the result.' : '可以利用免费试用检查你真正想看的课程或访谈。分别试一段安静内容和一段较难内容，使用平常的播放器模式，并核对重要信息。噪声、口音、多人同时说话和网络波动都可能改变结果。'],
    ],
  };
}
