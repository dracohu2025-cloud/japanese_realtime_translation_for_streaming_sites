const events = new Set(['video_play', 'video_complete', 'download_click', 'install_guide_click']);
const locales = new Set(['zh-CN', 'en']);
const retentionMs = 90 * 86400_000;

// 独立汇总表复用现有 SQLite 适配器；不保存 IP、账户、URL 或访客 ID。
export function createMarketing(database, now = () => Date.now()) {
  database.exec('CREATE TABLE IF NOT EXISTS kotoba_marketing_daily (day TEXT NOT NULL, locale TEXT NOT NULL, event TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(day, locale, event))');
  const prune = () => database.prepare('DELETE FROM kotoba_marketing_daily WHERE day < ?').run(new Date(now() - retentionMs + 86400_000).toISOString().slice(0, 10));
  return {
    record(input) {
      if (!input || !events.has(input.event) || !locales.has(input.locale) || Object.keys(input).some(key => !['event', 'locale'].includes(key))) return false;
      database.transactionSync(() => {
        prune();
        database.prepare('INSERT INTO kotoba_marketing_daily (day, locale, event, count) VALUES (?, ?, ?, 1) ON CONFLICT(day, locale, event) DO UPDATE SET count = MIN(count + 1, 1000000)')
          .run(new Date(now()).toISOString().slice(0, 10), input.locale, input.event);
      });
      return true;
    },
    report() {
      prune();
      const daily = {};
      for (const row of database.prepare('SELECT day, locale, event, count FROM kotoba_marketing_daily ORDER BY day').all()) {
        daily[row.day] ||= {};
        daily[row.day][row.locale + ':' + row.event] = row.count;
      }
      return { timezone: 'UTC', retentionDays: 90, daily, definitions: {
        video_play: 'First playing event per page load and language, not a click or unique viewer.',
        video_complete: 'First ended event per page load and language; seeking can reach the end.',
        download_click: 'Download-link click, not proof of download completion or installation.',
        install_guide_click: 'Installation-guide link click, not an installation.',
        limits: 'Client-reported, may contain bots or tests. Page reloads can count again. No visitor/account linkage; not a conversion funnel. Counts capped at 1,000,000 per day/language/event.',
      } };
    },
  };
}
