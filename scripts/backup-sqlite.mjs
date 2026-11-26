import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const sourceDb = path.resolve(
  process.argv[2] || process.env.DB_PATH || path.join(process.cwd(), 'data', 'hearthledger.db')
);
const outDir = path.resolve(process.argv[3] || path.join(process.cwd(), 'backups'));
fs.mkdirSync(outDir, { recursive: true });

if (!fs.existsSync(sourceDb)) {
  console.error(`Source SQLite DB not found: ${sourceDb}`);
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const destPath = path.join(outDir, `hearthledger-${stamp}.db`);
const db = new DatabaseSync(sourceDb, { readOnly: true });
const escaped = destPath.replace(/'/g, "''");
db.exec(`VACUUM INTO '${escaped}';`);
db.close();

console.log(`Snapshot backup created cleanly: ${destPath}`);
