import { randomBytes } from 'node:crypto';

export class AppError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function loadConfig(env = process.env) {
  const port = Number(env.PORT || 8787);
  const minutes = Number(env.MAX_SESSION_MINUTES || 60);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new AppError('CONFIG', 'PORT 必须为 1–65535');
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) throw new AppError('CONFIG', '会话时长必须为 1–240 分钟');
  if (env.RELAY_TOKEN && env.RELAY_TOKEN.length < 24) throw new AppError('CONFIG', '配对码至少需要 24 个字符');
  return {
    port, host: '127.0.0.1', token: env.RELAY_TOKEN || randomBytes(24).toString('hex'),
    apiKey: env.SONIOX_API_KEY || '', model: env.SONIOX_MODEL || 'stt-rt-v5',
    maxSessionMs: minutes * 60_000, maxConnections: 3,
  };
}

export function validateStart(value) {
  if (!value || value.type !== 'start' || typeof value.token !== 'string') throw new AppError('BAD_REQUEST', '请检查连接设置');
  if (!['zh', 'en', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'vi', 'th', 'id'].includes(value.targetLanguage)) throw new AppError('BAD_REQUEST', '不支持此目标语言');
  if (value.speakerDiarization !== undefined && typeof value.speakerDiarization !== 'boolean') throw new AppError('BAD_REQUEST', '说话人区分参数无效');
  const context = value.context ?? '';
  if (typeof context !== 'string' || context.length > 1000) throw new AppError('BAD_REQUEST', '背景提示最多 1000 字');
  const terms = value.terms ?? [];
  if (!Array.isArray(terms) || terms.length > 30 || terms.some(x => typeof x !== 'string' || x.length > 60)) {
    throw new AppError('BAD_REQUEST', '术语最多 30 个，每个最多 60 字');
  }
  return { speakerDiarization: value.speakerDiarization === true, targetLanguage: value.targetLanguage, context: context.trim(), terms: terms.map(x => x.trim()).filter(Boolean) };
}
