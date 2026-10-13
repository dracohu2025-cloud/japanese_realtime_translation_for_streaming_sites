import { Buffer } from 'node:buffer';
import { AppError, validateStart } from '../server/config.js';

// 非休眠连接：上游音频 WebSocket 存活时保留账户消费锁，实例重建会断开旧连接。
export function openStream(client, accounts, env, onClose) {
  const id = crypto.randomUUID();
  let state = 'auth', upstream, quota, credential, sequence = 0, pending = 0, received = 0, started = Date.now();
  let confirmedSamples = 0, compensate = false;
  let queue = Promise.resolve(), idle, deadline, credentials, finishTimer, disposed = false;
  const send = data => { if (client.readyState === 1) client.send(JSON.stringify(data)); };
  const close = () => {
    if (disposed) return;
    disposed = true; state = 'closed';
    clearTimeout(authTimer); clearTimeout(idle); clearTimeout(deadline); clearTimeout(finishTimer); clearInterval(credentials);
    if (upstream?.readyState === 1) { try { upstream.send(''); upstream.close(1000); } catch {} }
    if (client.readyState === 1) client.close(1000);
    queue.then(() => quota?.stop(id, { compensate, confirmedSamples })).catch(() => {}).finally(onClose);
  };
  const fail = (code, message) => {
    compensate = ['UPSTREAM_CLOSED', 'UPSTREAM_CONNECT', 'PROVIDER_ERROR', 'PROVIDER_FORMAT', 'PROVIDER_NETWORK', 'BAD_REQUEST'].includes(code);
    console.warn(JSON.stringify({ event: 'stream_failed', requestId: id, code, audioSeconds: received / 32000 }));
    send({ type: 'error', code, message }); close(); };
  const authTimer = setTimeout(() => fail('AUTH_TIMEOUT', '连接验证超时'), 5000);
  const resetIdle = () => { clearTimeout(idle); idle = setTimeout(() => fail('AUDIO_TIMEOUT', '没有收到音频，会话已停止'), 15_000); };
  const handle = async raw => {
    if (disposed) return;
    if (state === 'auth') {
      if (typeof raw !== 'string') throw new AppError('AUTH', '请先验证账户');
      const value = JSON.parse(raw);
      if (value.type === 'balance') {
        const account = accounts.authenticateStream(value.token);
        const result = await account.payments.status();
        send({ type: 'balance', remainingSeconds: result.seconds });
        close();
        return;
      }
      const options = validateStart(value);
      credential = value.token;
      quota = accounts.authenticateStream(credential).quota;
      await quota.start(id);
      if (disposed) return;
      clearTimeout(authTimer); state = 'connecting';
      // 超时仅约束握手；升级成功后 abort 会连带切断 WebSocket。
      const handshake = new AbortController();
      const handshakeTimer = setTimeout(() => handshake.abort(), 10_000);
      let response;
      try {
        response = await fetch('https://stt-rt.soniox.com/transcribe-websocket', {
          headers: { Upgrade: 'websocket', Authorization: `Bearer ${env.SONIOX_API_KEY}` },
          signal: handshake.signal,
        });
      } catch {
        throw new AppError('UPSTREAM_CONNECT', '语音服务连接失败', 502);
      } finally {
        clearTimeout(handshakeTimer);
      }
      if (response.status !== 101 || !response.webSocket) throw new AppError('UPSTREAM_CONNECT', '语音服务连接失败', 502);
      upstream = response.webSocket; upstream.accept();
      if (disposed) { upstream.close(1000); return; }
      upstream.addEventListener('message', event => {
        if (disposed) return;
        try {
          if (typeof event.data !== 'string' || event.data.length > 512_000) throw new Error();
          const data = JSON.parse(event.data);
          if (data.error_code || data.error_type) { fail('PROVIDER_ERROR', '语音服务拒绝或中断了请求'); return; }
          if (Number.isFinite(data.total_audio_proc_ms) && data.total_audio_proc_ms >= 0) confirmedSamples = Math.max(confirmedSamples, Math.min(received / 2, Math.floor(data.total_audio_proc_ms * 16)));
          if (Array.isArray(data.tokens)) send({ type: 'tokens', tokens: data.tokens.slice(0, 2000).map(t => ({
            text: String(t.text ?? '').slice(0, 2000), is_final: t.is_final === true,
            speaker: typeof t.speaker === 'string' && t.speaker.length <= 32 ? t.speaker : undefined,
            translation_status: t.translation_status, start_ms: t.start_ms, end_ms: t.end_ms,
          })), processedMs: data.total_audio_proc_ms ?? 0 });
          if (data.finished) close();
        } catch { fail('PROVIDER_FORMAT', '语音服务返回格式异常'); }
      });
      upstream.addEventListener('close', () => { if (!disposed && state !== 'stopping') fail('UPSTREAM_CLOSED', '语音服务已断开，请重新开始'); else close(); });
      upstream.addEventListener('error', () => fail('PROVIDER_NETWORK', '语音服务连接中断'));
      upstream.send(JSON.stringify({
        model: env.SONIOX_MODEL, client_reference_id: `kotoba:${id}`,
        audio_format: 'pcm_s16le', sample_rate: 16000, num_channels: 1,
        language_hints: ['ja'], enable_language_identification: true, enable_endpoint_detection: true,
        enable_speaker_diarization: options.speakerDiarization,
        translation: { type: 'one_way', target_language: options.targetLanguage },
        context: { terms: options.terms, ...(options.context ? { text: options.context } : {}) },
      }));
      state = 'streaming'; started = Date.now(); resetIdle();
      deadline = setTimeout(() => fail('TIME_LIMIT', '已达到 60 分钟会话上限，请重新开始'), 3600_000);
      credentials = setInterval(() => { try { accounts.authenticateStream(credential); } catch { fail('LOGIN_REQUIRED', '账户连接已过期，请重新登录'); } }, 5000);
      send({ type: 'ready', requestId: id, startedAt: started, model: env.SONIOX_MODEL });
    } else if (state === 'streaming' && typeof raw !== 'string') {
      const audio = Buffer.from(raw instanceof Blob ? await raw.arrayBuffer() : raw);
      received += audio.length;
      if (received > ((Date.now() - started) / 1000 + 5) * 32_000) throw new AppError('RATE_LIMIT', '音频发送过快');
      resetIdle();
      const result = await quota.write(id, sequence++, audio, frame => {
        if (disposed || upstream.readyState !== 1) return false;
        upstream.send(frame); return true;
      }, confirmedSamples);
      send({ type: 'quota', remainingSeconds: result.remainingSeconds });
      if (result.exhausted) fail('QUOTA_EXHAUSTED', '翻译时长已用完，已停止；不会自动加购');
    } else if (state === 'streaming' && typeof raw === 'string' && JSON.parse(raw).type === 'stop') {
      state = 'stopping'; clearTimeout(idle); upstream.send(''); finishTimer = setTimeout(close, 5000);
    } else throw new AppError('PROTOCOL', '会话状态不匹配');
  };
  client.addEventListener('message', event => {
    const size = typeof event.data === 'string' ? Buffer.byteLength(event.data) : event.data.size ?? event.data.byteLength;
    if (size > (typeof event.data === 'string' ? 8192 : 16000) || pending + size > 256_000) { fail('TOO_LARGE', '音频处理积压或数据过大'); return; }
    pending += size;
    queue = queue.then(() => handle(event.data)).catch(error => fail(error instanceof AppError ? error.code : 'BAD_REQUEST', error instanceof AppError ? error.message : '连接请求失败，请重试')).finally(() => { pending -= size; });
  });
  client.addEventListener('close', close); client.addEventListener('error', close);
}
