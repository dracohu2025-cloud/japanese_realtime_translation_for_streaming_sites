// 原创合成语音的可重复检查；最多两个语言会话，不是浏览器端到端或自然对话基准。
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import WebSocket from 'ws';

const directory = 'output/original-demo';
const key = process.env.SONIOX_API_KEY;
if (!key) throw new Error('SONIOX_API_KEY is required');
const pcm = execFileSync('ffmpeg', ['-v','error','-i',directory+'/japanese-study.wav','-f','s16le','-ar','16000','-ac','1','pipe:1']);
if (pcm.length > 60 * 32000) throw new Error('Sample exceeds 60 seconds');
async function check(language) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://stt-rt.soniox.com/transcribe-websocket');
    const tokens = [], events = []; let timer, started, firstTextMs, firstTranslationMs, offset = 0, done = false;
    const timeout = setTimeout(() => finish(new Error('Sample timeout')), 90000);
    function finish(error) {
      if (done) return; done = true; clearInterval(timer); clearTimeout(timeout); ws.close();
      if (error) reject(error); else resolve({ language, audioSeconds: pcm.length / 32000, firstTextMs, firstTranslationMs, elapsedMs: Date.now() - started, tokens, events });
    }
    ws.on('open', () => {
      ws.send(JSON.stringify({ api_key:key, model:'stt-rt-v5', audio_format:'pcm_s16le', sample_rate:16000, num_channels:1, language_hints:['ja'], enable_language_identification:true, enable_endpoint_detection:true, translation:{type:'one_way',target_language:language} }));
      started = Date.now();
      const send = () => { if (offset >= pcm.length) { clearInterval(timer); ws.send(''); return; } ws.send(pcm.subarray(offset, offset + 6400)); offset += 6400; };
      send(); timer = setInterval(send, 200);
    });
    ws.on('message', raw => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.error_code || data.error_type) return finish(new Error('Provider error: ' + (data.error_type || data.error_code)));
        const atMs = Date.now() - started;
        for (const t of data.tokens || []) {
          if (t.text && !/^<.*>$/.test(t.text)) {
            firstTextMs ??= atMs;
            if (t.translation_status === 'translation') firstTranslationMs ??= atMs;
          }
          if (t.is_final) tokens.push(t);
        }
        if (data.tokens?.length) events.push({ atMs, tokens: data.tokens });
        if (data.finished) finish();
      } catch { finish(new Error('Invalid sample response')); }
    });
    ws.on('error', () => finish(new Error('Sample network error')));
    ws.on('close', () => { if (!done) finish(new Error('Sample closed before final response')); });
  });
}
const results = await Promise.all(['zh','en'].map(check));
const report = { recordedAt: new Date().toISOString(), model:'stt-rt-v5', audioSha256:createHash('sha256').update(pcm).digest('hex'), methodology:'Synthetic speech generated from our original Japanese script. Audio streamed in 200 ms PCM frames to the currently configured speech model. Does not include Chrome capture, Kotoba relay or on-screen rendering. First result timings start at the first audio send, not the end of a spoken sentence. No background noise or overlapping speakers.', results };
await fs.writeFile(directory+'/results.json', JSON.stringify(report,null,2));
console.log(results.map(r=>({language:r.language,audioSeconds:r.audioSeconds,firstTranslationMs:r.firstTranslationMs,finalTokens:r.tokens.length})));
