import path from 'node:path';
import { createSyncServer } from './app.mjs';

const port = Number(process.env.PORT || 4174);
const host = process.env.HOST || '127.0.0.1';
const dbPath =
  process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'hearthledger.db');

const { server, close } = createSyncServer({ dbPath });

server.listen(port, host, () => {
  console.log(`HearthLedger Sync Server listening on http://${host}:${port} (SQLite: ${dbPath})`);
});

const shutdown = () => {
  void close().then(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
