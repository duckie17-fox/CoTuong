// Giả lập API Cloudflare D1 bằng node:sqlite (Node ≥ 22) — để test và chạy server thử bằng Node
// với đúng mã server/src/accounts.js. Chỉ hỗ trợ phần API mà server dùng.
const fs = require('fs');
const path = require('path');

function createD1(file = ':memory:') {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');
  const dir = path.join(__dirname, '..', 'server', 'migrations');
  const applied = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (!applied) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  const norm = v => v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v;
  const plain = r => r ? Object.assign({}, r) : null;
  class Stmt {
    constructor(sql, args = []) { this.sql = sql; this.args = args; }
    bind(...a) { return new Stmt(this.sql, a.map(norm)); }
    async first(col) { const r = plain(db.prepare(this.sql).get(...this.args)); return col ? (r ? r[col] : null) : r; }
    async all() { return { results: db.prepare(this.sql).all(...this.args).map(plain), success: true }; }
    async run() { const i = db.prepare(this.sql).run(...this.args); return { success: true, meta: { changes: Number(i.changes), last_row_id: Number(i.lastInsertRowid) } }; }
    _runSync() { const i = db.prepare(this.sql).run(...this.args); return { success: true, meta: { changes: Number(i.changes), last_row_id: Number(i.lastInsertRowid) } }; }
  }
  return {
    prepare: sql => new Stmt(sql),
    async batch(stmts) {
      db.exec('BEGIN');
      try { const out = stmts.map(s => s._runSync()); db.exec('COMMIT'); return out; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    raw: db,
  };
}
module.exports = { createD1 };
