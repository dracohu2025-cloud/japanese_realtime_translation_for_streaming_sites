import { connectSoniox } from '../server/soniox.js';
import { CaptionBuffer } from '../extension/shared/captions.js';
import { AppError } from '../server/config.js';

/** 主进程翻译会话：PCM → Soniox → 字幕快照。 */
export class TranslateSession {
  constructor({ apiKey, model, maxSessionMs = 60 * 60_000, onEvent }) {
    this.apiKey = apiKey;
    this.model = model;
    this.maxSessionMs = maxSessionMs;
    this.onEvent = onEvent;
    this.captions = new CaptionBuffer();
    this.provider = null;
    this.deadline = null;
    this.idle = null;
    this.started = 0;
    this.bytes = 0;
    this.status = 'idle';
  }

  emit(payload) {
    this.onEvent?.(payload);
  }

  async start({ targetLanguage = 'zh', context = '', terms = [] } = {}) {
    if (!this.apiKey) throw new AppError('NOT_CONFIGURED', '尚未配置 SONIOX_API_KEY，请在项目根目录 .env 中填写');
    this.stop('restart');
    this.captions.reset();
    this.status = 'connecting';
    this.bytes = 0;
    this.started = Date.now();
    this.emit({ type: 'status', status: 'connecting', captions: this.captions.snapshot() });

    this.provider = connectSoniox(
      { apiKey: this.apiKey, model: this.model },
      { targetLanguage, context, terms },
      data => {
        if (data.type === 'tokens') {
          this.emit({ type: 'captions', captions: this.captions.push(data.tokens), processedMs: data.processedMs });
        } else if (data.type === 'error') {
          this.status = 'error';
          this.emit({ type: 'status', status: 'error', message: data.message });
          this.stop('error');
        } else if (data.type === 'closed') {
          if (this.status === 'listening') {
            this.status = 'error';
            this.emit({ type: 'status', status: 'error', message: '语音服务已断开，请重新开始' });
          }
          this.stop('closed');
        }
      },
    );

    await this.provider.ready;
    this.status = 'listening';
    this.deadline = setTimeout(() => {
      this.status = 'error';
      this.emit({ type: 'status', status: 'error', message: '已达到本次会话时长上限，请重新开始' });
      this.stop('time_limit');
    }, this.maxSessionMs);
    this.idle = setTimeout(() => {
      this.status = 'error';
      this.emit({ type: 'status', status: 'error', message: '没有收到音频，会话已停止' });
      this.stop('audio_timeout');
    }, 60_000);
    this.emit({ type: 'status', status: 'listening', captions: this.captions.snapshot() });
  }

  writePcm(buffer) {
    if (this.status !== 'listening' || !this.provider) return;
    const raw = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    if (raw.length % 2 || raw.length > 16_000) return;
    this.bytes += raw.length;
    if (this.bytes > ((Date.now() - this.started) / 1000 + 5) * 32_000) {
      this.status = 'error';
      this.emit({ type: 'status', status: 'error', message: '音频发送过快，会话已停止' });
      this.stop('rate_limit');
      return;
    }
    this.idle?.refresh?.();
    try {
      this.provider.write(raw);
      this.emit({
        type: 'meter',
        audioSeconds: this.bytes / 32_000,
      });
    } catch (error) {
      this.status = 'error';
      this.emit({ type: 'status', status: 'error', message: error.message || '音频上传失败' });
      this.stop('write_failed');
    }
  }

  stop(reason = 'user') {
    clearTimeout(this.deadline);
    clearTimeout(this.idle);
    this.deadline = null;
    this.idle = null;
    const provider = this.provider;
    this.provider = null;
    if (provider) {
      if (reason === 'user' || reason === 'restart') provider.finish();
      else provider.close();
    }
    if (this.status !== 'error') this.status = 'idle';
    if (reason === 'user' || reason === 'restart') {
      this.captions.reset();
      this.emit({ type: 'status', status: 'idle', captions: this.captions.snapshot(), reason });
    }
  }
}
