import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
export { onRequest } from '../../functions/api/[[path]].js';
export { computeHmacHexWeb } from '../../server/edge/billingCore.mjs';

export function createLegacyPreOAuthSqliteFile() {
  const dir = fs.mkdtempSync(path.join(process.cwd(), '.tmp-oauth-mig-'));
  const dbPath = path.join(dir, 'legacy.db');
  const legacySqlite = new DatabaseSync(dbPath);
  legacySqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL DEFAULT 'default',
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      member_id TEXT NOT NULL,
      avatar TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  legacySqlite.close();
  return {
    dbPath,
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

export function createMockD1Database() {
  const sqlite = new DatabaseSync(':memory:');

  class MockPreparedStatement {
    constructor(sql, params = []) {
      this.sql = sql;
      this.params = params;
    }
    bind(...args) {
      return new MockPreparedStatement(this.sql, args);
    }
    async first() {
      const stmt = sqlite.prepare(this.sql);
      return stmt.get(...this.params) ?? null;
    }
    async all() {
      const stmt = sqlite.prepare(this.sql);
      return { results: stmt.all(...this.params), success: true };
    }
    async run() {
      const stmt = sqlite.prepare(this.sql);
      const info = stmt.run(...this.params);
      return {
        success: true,
        meta: {
          changes: Number(info.changes ?? 0),
          last_row_id: Number(info.lastInsertRowid ?? 0),
        },
      };
    }
  }

  return {
    prepare(sql) {
      return new MockPreparedStatement(sql);
    },
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const out = [];
        for (const s of statements) {
          const upper = s.sql.trim().toUpperCase();
          if (upper.startsWith('SELECT')) {
            out.push(await s.all());
          } else {
            out.push(await s.run());
          }
        }
        sqlite.exec('COMMIT');
        return out;
      } catch (err) {
        try {
          sqlite.exec('ROLLBACK');
        } catch {
          // ignore
        }
        throw err;
      }
    },
    async exec(sql) {
      sqlite.exec(sql);
      return { count: 1 };
    },
    close() {
      sqlite.close();
    },
  };
}
