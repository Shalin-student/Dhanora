// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { createSyncServer, type SyncServerInstance } from '../../server/app.mjs';
import { createSeedState } from '../data/seed';
import {
  checkSyncHealth,
  deleteServerReceipt,
  fetchServerReceipt,
  fetchServerState,
  pushServerReceipt,
  pushServerState,
} from '../storage/syncClient';
import type { ReceiptRecord } from '../types/finance';

const activeServers: SyncServerInstance[] = [];

async function startTestServer(syncKey?: string) {
  const instance = createSyncServer({ dbPath: ':memory:', syncKey });
  activeServers.push(instance);
  await new Promise<void>((resolve) => {
    instance.server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = instance.server.address();
  if (!addr || typeof addr === 'string') {
    throw new Error('Expected TCP address object from sync server');
  }
  return {
    instance,
    baseUrl: `http://127.0.0.1:${addr.port}`,
  };
}

describe('Node + SQLite Sync Server & Client Integration', () => {
  afterEach(async () => {
    while (activeServers.length > 0) {
      const srv = activeServers.pop();
      if (srv) await srv.close();
    }
  });

  it('checks health, pushes initial snapshot, increments revisions, and logs household activity', async () => {
    const { baseUrl } = await startTestServer();
    const config = { serverUrl: baseUrl };

    const health0 = await checkSyncHealth(config);
    expect(health0).toEqual({ available: true, revision: 0 });

    const initial = await fetchServerState(config);
    expect(initial?.revision).toBe(0);
    expect(initial?.state).toBeNull();

    const seed = createSeedState();
    const stateWithInlineReceipt = {
      ...seed,
      transactions: [
        {
          ...seed.transactions[0],
          receiptDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
        },
        ...seed.transactions.slice(1),
      ],
    };

    const push1 = await pushServerState(config, {
      baseRevision: 0,
      state: stateWithInlineReceipt,
      actor: { memberId: 'm-alex', memberName: 'Alex', memberAvatar: '🧑🏽‍💻' },
      auditEntry: {
        action: 'Initial sync',
        summary: 'Uploaded household baseline ledger',
        entityType: 'sync',
      },
      clientId: 'client-a',
    });

    expect(push1).not.toBeNull();
    expect(push1?.ok).toBe(true);
    if (push1?.ok) {
      expect(push1.revision).toBe(1);
      expect(push1.activity[0].memberName).toBe('Alex');
      expect(push1.activity[0].action).toBe('Initial sync');
    }

    // Server strips inline receiptDataUrl blobs before persisting snapshot JSON
    const fetched = await fetchServerState(config);
    expect(fetched?.revision).toBe(1);
    expect(fetched?.state?.transactions[0].receiptDataUrl).toBeUndefined();
    expect(fetched?.activity).toHaveLength(1);
  });

  it('detects stale optimistic baseRevision conflicts (HTTP 409) and allows subsequent syncs', async () => {
    const { baseUrl } = await startTestServer();
    const config = { serverUrl: baseUrl };
    const seed = createSeedState();

    const firstPush = await pushServerState(config, {
      baseRevision: 0,
      state: seed,
      actor: { memberId: 'm-alex', memberName: 'Alex', memberAvatar: '🧑🏽‍💻' },
      auditEntry: {
        action: 'Add expense',
        summary: 'Alex added Weekly Groceries',
        entityType: 'transaction',
      },
      clientId: 'client-a',
    });
    expect(firstPush?.ok).toBe(true);

    // Second device attempts to push with stale revision 0
    const stalePush = await pushServerState(config, {
      baseRevision: 0,
      state: {
        ...seed,
        settings: { ...seed.settings, householdName: 'Stale Override Attempt' },
      },
      actor: { memberId: 'm-maya', memberName: 'Maya', memberAvatar: '👩🏽‍🎨' },
      clientId: 'client-b',
    });

    expect(stalePush?.ok).toBe(false);
    expect(stalePush?.conflict).toBe(true);
    if (stalePush && !stalePush.ok) {
      expect(stalePush.serverRevision).toBe(1);
      expect(stalePush.serverState?.settings.householdName).toBe('The Carter Family');
    }

    // Rebased push using revision 1 succeeds
    const rebasedPush = await pushServerState(config, {
      baseRevision: 1,
      state: {
        ...seed,
        settings: { ...seed.settings, householdName: 'The Carter Synced Family' },
      },
      actor: { memberId: 'm-maya', memberName: 'Maya', memberAvatar: '👩🏽‍🎨' },
      auditEntry: {
        action: 'Rename household',
        summary: 'Maya renamed household after rebase',
        entityType: 'settings',
      },
      clientId: 'client-b',
    });

    expect(rebasedPush?.ok).toBe(true);
    if (rebasedPush?.ok) {
      expect(rebasedPush.revision).toBe(2);
      expect(rebasedPush.activity[0].memberName).toBe('Maya');
    }
  });

  it('uploads, fetches, lists metadata, and deletes receipt binaries in SQLite', async () => {
    const { baseUrl } = await startTestServer();
    const config = { serverUrl: baseUrl };

    const receipt: ReceiptRecord = {
      id: 'rcpt-tx-test',
      txId: 'tx-test',
      fileName: 'hardware-receipt.png',
      mimeType: 'image/png',
      sizeBytes: 24,
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
      createdAt: '2026-11-25T10:00:00Z',
    };

    const pushed = await pushServerReceipt(config, receipt);
    expect(pushed).toBe(true);

    const fetched = await fetchServerReceipt(config, receipt.id);
    expect(fetched).toMatchObject({
      id: receipt.id,
      txId: receipt.txId,
      fileName: 'hardware-receipt.png',
      dataUrl: receipt.dataUrl,
    });

    const listRes = await fetch(`${baseUrl}/api/receipts`);
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { receipts: Array<{ id: string }> };
    expect(listBody.receipts.map((r) => r.id)).toContain(receipt.id);

    const deleted = await deleteServerReceipt(config, receipt.id);
    expect(deleted).toBe(true);

    const afterDelete = await fetchServerReceipt(config, receipt.id);
    expect(afterDelete).toBeNull();
  });

  it('enforces X-Household-Sync-Key when configured', async () => {
    const { baseUrl } = await startTestServer('family-secret-77');

    const denied = await checkSyncHealth({ serverUrl: baseUrl, syncKey: 'wrong-key' });
    expect(denied).toEqual({ available: false, unauthorized: true });

    const granted = await checkSyncHealth({ serverUrl: baseUrl, syncKey: 'family-secret-77' });
    expect(granted).toEqual({ available: true, revision: 0 });
  });

  it('registers users with role metadata and verifies logins via /api/auth endpoints', async () => {
    const { baseUrl } = await startTestServer();

    const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Kiran Patel',
        email: 'kiran@patel.in',
        password: 'strong-passphrase',
        role: 'partner',
        memberId: 'm-kiran',
      }),
    });
    expect(signupRes.status).toBe(200);
    const signupJson = (await signupRes.json()) as { ok: boolean; session: { role: string } };
    expect(signupJson.ok).toBe(true);
    expect(signupJson.session.role).toBe('partner');

    const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'kiran@patel.in', password: 'wrong' }),
    });
    expect(badLogin.status).toBe(401);

    const goodLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'kiran@patel.in', password: 'strong-passphrase' }),
    });
    expect(goodLogin.status).toBe(200);
    const loginJson = (await goodLogin.json()) as {
      ok: boolean;
      session: { role: string; email: string };
    };
    expect(loginJson.session.role).toBe('partner');
    expect(loginJson.session.email).toBe('kiran@patel.in');
  });
});
