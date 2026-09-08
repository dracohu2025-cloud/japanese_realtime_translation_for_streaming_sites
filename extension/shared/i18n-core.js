// 可被扩展内容脚本直接注入，也通过 i18n.js 供网页和服务端复用。
(() => {
  if (globalThis.KotobaI18n) return;
  const messages = globalThis.KotobaMessages;
  function resolveLocale(preference, languages = ['en']) {
    if (preference === 'zh-CN' || preference === 'en') return preference;
    for (const value of languages) {
      const language = String(value).toLowerCase();
      if (/^zh(?:-|$)/.test(language)) return 'zh-CN';
      if (/^en(?:-|$)/.test(language)) return 'en';
    }
    return 'en';
  }
  function createTranslator(initial = 'en') {
    let locale = resolveLocale(initial);
    const t = (key, values = {}) => {
      const template = locale === 'en' ? messages[key] ?? key : key;
      return String(template ?? '').replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
    };
    const number = value => new Intl.NumberFormat(locale).format(value);
    return {
      t, getLocale: () => locale, setLocale: value => { locale = resolveLocale(value); },
      number,
      money: cents => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', currencyDisplay: 'code' }).format(cents / 100),
      percent: value => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(value / 100),
      date: value => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)),
      time: value => new Intl.DateTimeFormat(locale, { timeStyle: 'medium' }).format(new Date(value)),
      duration: seconds => {
        const total = Math.max(0, Math.floor(Number(seconds) || 0));
        const values = [Math.floor(total / 3600), Math.floor(total % 3600 / 60), total % 60];
        const units = ['hour', 'minute', 'second'];
        return values.flatMap((value, i) => value || (i === 2 && !total) ? [new Intl.NumberFormat(locale, { style: 'unit', unit: units[i], unitDisplay: 'long' }).format(value)] : []).join(' ');
      },
    };
  }
  globalThis.KotobaI18n = { createTranslator, resolveLocale, messages };
})();
