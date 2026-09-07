/** 仅接受供应商的会话内编号，不从文本、性别或当前原文推断译文说话人。 */
export function normalizeSpeaker(value) {
  return typeof value === 'string' && /^(?:[1-9]|1[0-5])$/.test(value) ? value : null;
}

function trim(parts, limit) {
  let extra = parts.reduce((sum, part) => sum + part.text.length, 0) - limit;
  while (extra > 0 && parts.length) {
    const first = parts[0];
    if (first.text.length <= extra) { extra -= first.text.length; parts.shift(); }
    else { first.text = first.text.slice(extra); break; }
  }
  return parts;
}

/** 两条语言轨各自保留说话人分组；临时结果每包替换，最终结果只追加一次。 */
export class CaptionBuffer {
  constructor(limit = 160, { retainHistory = false } = {}) {
    this.limit = limit;
    this.retainHistory = retainHistory;
    this.reset();
  }

  reset() {
    this.final = { original: [], translation: [] };
    this.partial = { original: [], translation: [] };
    this.boundary = { original: false, translation: false };
  }

  push(tokens = []) {
    this.partial = { original: [], translation: [] };
    for (const token of tokens) {
      if (!token || typeof token.text !== 'string' || !token.text) continue;
      const lane = token.translation_status === 'translation' ? 'translation' : 'original';
      if (/^<(?:end|fin)>$/.test(token.text)) {
        if (token.is_final) this.boundary[lane] = true;
        continue;
      }
      if (/^<[^>]+>$/.test(token.text)) continue;
      if (this.boundary[lane] && token.text.trim()) {
        if (this.retainHistory) {
          const last = this.final[lane].at(-1);
          if (last && !last.text.endsWith('\n')) last.text += '\n';
        } else this.final[lane] = [];
        this.boundary[lane] = false;
      }
      const parts = (token.is_final ? this.final : this.partial)[lane];
      const speaker = normalizeSpeaker(token.speaker);
      if (parts.length && parts.at(-1).speaker === speaker) parts.at(-1).text += token.text;
      else parts.push({ text: token.text, speaker });
      trim(parts, this.limit);
    }
    return this.snapshot();
  }

  snapshot() {
    return Object.fromEntries(['original', 'translation'].map(lane => {
      const parts = trim([
        ...this.final[lane].map(part => ({ ...part, isFinal: true })),
        ...this.partial[lane].map(part => ({ ...part, isFinal: false })),
      ], this.limit);
      const runs = [];
      for (const part of parts) {
        if (!runs.length || runs.at(-1).speaker !== part.speaker) runs.push({ speaker: part.speaker, final: '', partial: '' });
        runs.at(-1)[part.isFinal ? 'final' : 'partial'] += part.text;
      }
      const final = parts.filter(part => part.isFinal).map(part => part.text).join('');
      const partial = parts.filter(part => !part.isFinal).map(part => part.text).join('');
      return [lane, { final, partial, text: final + partial, runs }];
    }));
  }
}
