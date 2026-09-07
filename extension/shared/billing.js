// 价格参考：Soniox stt-rt-v5，2026-09-07。字符与音频 token 均为估算。
export function estimateBilling(segments, now = Date.now()) {
  if (!segments.length || segments.some(s => s.model !== 'stt-rt-v5')) return null;
  return segments.reduce((sum, s) => {
    const seconds = Math.max(s.audioSeconds || 0, ((s.endedAt || now) - s.startedAt) / 1000, 0);
    return sum + seconds * (30000 / 3600) * 2 / 1e6
      + ((s.inputChars || 0) + (s.finalChars || 0) + (s.partialChars || 0)) * .3 * 4 / 1e6;
  }, 0);
}

export function countTokenCharacters(segment, tokens) {
  segment.partialChars = 0;
  for (const token of tokens) {
    const chars = [...String(token.text || '').replace(/<(?:end|fin)>/g, '')].length;
    if (token.is_final) segment.finalChars += chars;
    else segment.partialChars += chars;
  }
}
