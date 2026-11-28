export interface MockD1Database {
  prepare(sql: string): unknown;
  batch(statements: unknown[]): Promise<unknown[]>;
  exec(sql: string): Promise<{ count: number }>;
  close(): void;
}

export function createLegacyPreOAuthSqliteFile(): {
  dbPath: string;
  cleanup: () => void;
};
export function createMockD1Database(): MockD1Database;
export function onRequest(context: {
  request: Request;
  env: Record<string, unknown>;
}): Promise<Response>;
export function computeHmacHexWeb(payload: string, secret: string): Promise<string>;
