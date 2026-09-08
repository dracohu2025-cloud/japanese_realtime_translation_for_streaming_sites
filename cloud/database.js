import { Kysely, SqliteDialect } from 'kysely';

// 将现有同步账本接口适配到 Durable Object 自带 SQLite，游标不跨 await。
export function cloudDatabase(storage) {
  const query = (sql, args = []) => storage.sql.exec(sql, ...args);
  const database = {
    exec: sql => query(sql).toArray(),
    transactionSync: fn => storage.transactionSync(fn),
    prepare: sql => ({
      get: (...args) => query(sql, args).toArray()[0],
      all: (...args) => query(sql, args).toArray(),
      run: (...args) => { query(sql, args).toArray(); return query('SELECT changes() AS changes').toArray()[0]; },
    }),
  };
  const connection = {
    async executeQuery({ sql, parameters }) {
      const rows = query(sql, [...parameters]).toArray();
      const { changes } = query('SELECT changes() AS changes').toArray()[0];
      return { rows, numAffectedRows: BigInt(changes) };
    },
    async *streamQuery() { throw new Error('不支持流式 SQL'); },
  };
  const dialect = new SqliteDialect({ database: {} });
  dialect.createDriver = () => ({
    async init() {}, async acquireConnection() { return connection; }, async releaseConnection() {}, async destroy() {},
    async beginTransaction() { throw new Error('请使用 Durable Object transactionSync'); },
    async commitTransaction() { throw new Error('不支持 SQL 事务命令'); },
    async rollbackTransaction() { throw new Error('不支持 SQL 事务命令'); },
  });
  return { database, authDatabase: { db: new Kysely({ dialect }), type: 'sqlite', transaction: false } };
}
