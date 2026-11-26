import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSeedState } from '../data/seed';
import {
  clearAllReceiptRecords,
  getAllReceiptRecords,
  getReceiptRecord,
  hasIndexedDb,
  LEGACY_LOCALSTORAGE_KEY,
  loadAppStateFromRepo,
  purgeOrphanReceipts,
  saveAppStateToRepo,
  saveReceiptRecord,
} from '../storage/repository';

describe('Real IndexedDB Storage & Orphan GC (fake-indexeddb)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearAllReceiptRecords();
  });

  it('detects indexedDB, persists AppState, and migrates legacy localStorage cleanly', async () => {
    expect(hasIndexedDb()).toBe(true);

    const seed = createSeedState();
    const sampleDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    const legacyState = {
      ...seed,
      settings: {
        ...seed.settings,
        pinEnabled: true,
        pinCode: '9182',
      },
      transactions: [
        {
          ...seed.transactions[0],
          receiptName: 'idb-receipt.png',
          receiptDataUrl: sampleDataUrl,
        },
        ...seed.transactions.slice(1),
      ],
    };

    localStorage.setItem(LEGACY_LOCALSTORAGE_KEY, JSON.stringify(legacyState));

    const { state: migrated, migratedFromLegacy } = await loadAppStateFromRepo();
    expect(migratedFromLegacy).toBe(true);
    expect(migrated?.settings.pinCode).toBeUndefined();
    expect(migrated?.settings.pinHash).toHaveLength(64);
    expect(localStorage.getItem(LEGACY_LOCALSTORAGE_KEY)).toBeNull();

    // Verify receipt was written into real IndexedDB receipts object store
    const receipt = await getReceiptRecord(`rcpt-${seed.transactions[0].id}`);
    expect(receipt?.fileName).toBe('idb-receipt.png');
    expect(receipt?.dataUrl).toBe(sampleDataUrl);

    // Reload directly from IndexedDB
    const reloaded = await loadAppStateFromRepo();
    expect(reloaded.migratedFromLegacy).toBe(false);
    expect(reloaded.state?.transactions[0].receiptId).toBe(`rcpt-${seed.transactions[0].id}`);
  });

  it('purges orphaned receipt blobs in IndexedDB while preserving active ones', async () => {
    const seed = createSeedState();
    const activeTx = {
      ...seed.transactions[0],
      receiptId: 'rcpt-active',
      receiptName: 'active.png',
      receiptSizeBytes: 10,
    };

    await saveAppStateToRepo({
      ...seed,
      transactions: [activeTx],
    });

    await saveReceiptRecord({
      id: 'rcpt-active',
      txId: activeTx.id,
      fileName: 'active.png',
      mimeType: 'image/png',
      sizeBytes: 10,
      dataUrl: 'data:image/png;base64,AAAA',
      createdAt: new Date().toISOString(),
    });
    await saveReceiptRecord({
      id: 'rcpt-orphan-deleted',
      txId: 'tx-deleted',
      fileName: 'orphan.png',
      mimeType: 'image/png',
      sizeBytes: 10,
      dataUrl: 'data:image/png;base64,BBBB',
      createdAt: new Date().toISOString(),
    });

    const purgedCount = await purgeOrphanReceipts([activeTx]);
    expect(purgedCount).toBe(1);

    const remaining = await getAllReceiptRecords();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('rcpt-active');
  });
});
