import type { SyncDatabase } from './db.mjs';

export interface SyncServerOptions {
  dbPath?: string;
  distDir?: string;
  syncKey?: string;
  requireAuthForSync?: boolean;
  disableRateLimit?: boolean;
  appBaseUrl?: string;
  googleSiteVerification?: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}

export interface SyncServerInstance {
  server: {
    listen: (port: number, hostname?: string, listeningListener?: () => void) => void;
    address: () => { port: number; address: string; family: string } | string | null;
  };
  store: SyncDatabase;
  close: () => Promise<void>;
}

/**
 * Creates the HearthLedger Node HTTP + SQLite sync server instance.
 */
export function createSyncServer(options?: SyncServerOptions): SyncServerInstance;
