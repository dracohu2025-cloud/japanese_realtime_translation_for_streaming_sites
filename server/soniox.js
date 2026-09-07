import WebSocket from 'ws';
import { AppError } from './config.js';

/** 供应商边界：不向浏览器转发供应商密钥或原始错误消息。 */
export function connectSoniox(config, options, emit, endpoint = 'wss://stt-rt.soniox.com/transcribe-websocket') {
  const socket = new WebSocket(endpoint, { handshakeTimeout: 10_000, maxPayload: 512 * 1024 });
  let ended = false;
  let finishTimer;
  const ready = new Promise((resolve, reject) => {
    socket.once('open', () => {
      const context = { terms: options.terms };
      if (options.context) context.text = options.context;
      socket.send(JSON.stringify({
        api_key: config.apiKey, model: config.model, client_reference_id: options.clientReferenceId,
        audio_format: 'pcm_s16le', sample_rate: 16000, num_channels: 1,
        language_hints: ['ja'], enable_language_identification: true,
        enable_endpoint_detection: true,
        enable_speaker_diarization: options.speakerDiarization === true,
        translation: { type: 'one_way', target_language: options.targetLanguage },
        context,
      }));
      resolve();
    });
    socket.once('error', () => reject(new AppError('UPSTREAM_CONNECT', '语音服务连接失败，请稍后重新开始', 502)));
    socket.once('close', () => reject(new AppError('UPSTREAM_CONNECT', '语音服务连接已关闭', 502)));
  });
  socket.on('message', raw => {
    try {
      const data = JSON.parse(raw.toString());
      if (data.error_code || data.error_type) {
        const auth = data.error_code === 401;
        emit({ type: 'error', code: auth ? 'PROVIDER_AUTH' : 'PROVIDER_ERROR', message: auth ? '供应商密钥无效，请检查服务端配置' : '语音服务拒绝或中断了请求，请检查额度与模型配置' });
        socket.close();
        return;
      }
      if (Array.isArray(data.tokens)) {
        emit({ type: 'tokens', tokens: data.tokens.map(t => ({
          text: String(t.text ?? '').slice(0, 2000), is_final: t.is_final === true,
          speaker: typeof t.speaker === 'string' && t.speaker.length <= 32 ? t.speaker : undefined,
          translation_status: t.translation_status, start_ms: t.start_ms, end_ms: t.end_ms,
        })), processedMs: data.total_audio_proc_ms ?? 0 });
      }
      if (data.finished) ended = true;
    } catch {
      emit({ type: 'error', code: 'PROVIDER_FORMAT', message: '语音服务返回了无法识别的数据' });
      socket.close();
    }
  });
  socket.on('error', () => {
    if (!ended) emit({ type: 'error', code: 'PROVIDER_NETWORK', message: '语音服务连接中断，请重新开始' });
  });
  socket.on('close', () => {
    clearTimeout(finishTimer);
    emit({ type: 'closed', expected: ended });
  });
  return {
    ready,
    write(data) {
      if (socket.readyState !== WebSocket.OPEN || ended) return;
      if (socket.bufferedAmount > 256_000) throw new AppError('SLOW_NETWORK', '网络无法跟上播放速度，会话已停止', 503);
      socket.send(data, { binary: true });
    },
    finish() {
      if (ended) return;
      ended = true;
      if (socket.readyState === WebSocket.OPEN) socket.send('');
      finishTimer = setTimeout(() => socket.terminate(), 5000);
    },
    close() {
      ended = true;
      clearTimeout(finishTimer);
      socket.terminate();
    },
  };
}
