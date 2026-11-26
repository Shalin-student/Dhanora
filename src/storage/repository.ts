import type { AppState, ReceiptRecord } from '../types/finance';
import { estimateDataUrlBytes } from '../utils/image';
import { createPinCredentials } from '../utils/security';

export const LEGACY_LOCALSTORAGE_KEY = 'hearthledger_family_finance_v1';
const DB_NAME = 'hearthledger_db';
const DB_VERSION = 1;
const STORE_KV = 'kv';
const STORE_RECEIPTS = 'receipts';
const STATE_KEY = 'app_state';

function resolveRepoKeys(householdId?: string): { kvKey: string; lsKey: string } {
  const clean = (householdId ?? '').trim();
  if (!clean || clean === 'default') {
    return { kvKey: STATE_KEY, lsKey: LEGACY_LOCALSTORAGE_KEY };
  }
  return {
    kvKey: `${STATE_KEY}:${clean}`,
    lsKey: `${LEGACY_LOCALSTORAGE_KEY}:${clean}`,
  };
}

// Fallback in-memory stores used when IndexedDB is unavailable (e.g. jsdom unit tests)
const memoryKv = new Map<string, AppState>();
const memoryReceipts = new Map<string, ReceiptRecord>();

export function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV);
      }
      if (!db.objectStoreNames.contains(STORE_RECEIPTS)) {
        const store = db.createObjectStore(STORE_RECEIPTS, { keyPath: 'id' });
        store.createIndex('txId', 'txId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

function stripInlineReceipts(state: AppState): AppState {
  let changed = false;
  const transactions = state.transactions.map((tx) => {
    if (!tx.receiptDataUrl) return tx;
    changed = true;
    const { receiptDataUrl: _omitted, ...rest } = tx;
    return rest;
  });
  if (!changed) return state;
  return { ...state, transactions };
}

export async function sanitizeAndMigrateState(
  rawState: AppState
): Promise<{ cleanState: AppState; extractedReceipts: ReceiptRecord[]; changed: boolean }> {
  let changed = false;
  const extractedReceipts: ReceiptRecord[] = [];

  const nextTransactions = rawState.transactions.map((tx) => {
    if (!tx.receiptDataUrl) return tx;
    changed = true;
    const receiptId = tx.receiptId ?? `rcpt-${tx.id}`;
    const sizeBytes = tx.receiptSizeBytes ?? estimateDataUrlBytes(tx.receiptDataUrl);
    const mimeMatch = /^data:([^;]+);/.exec(tx.receiptDataUrl);
    extractedReceipts.push({
      id: receiptId,
      txId: tx.id,
      fileName: tx.receiptName ?? 'receipt.png',
      mimeType: mimeMatch?.[1] ?? 'image/png',
      sizeBytes,
      dataUrl: tx.receiptDataUrl,
      createdAt: tx.createdAt || new Date().toISOString(),
    });
    const { receiptDataUrl: _omitted, ...rest } = tx;
    return {
      ...rest,
      receiptId,
      receiptSizeBytes: sizeBytes,
    };
  });

  let nextSettings = {
    ...rawState.settings,
    language: rawState.settings.language === 'gu' ? ('gu' as const) : ('en' as const),
    autoLockMinutes: rawState.settings.autoLockMinutes ?? 0,
    syncEnabled: rawState.settings.syncEnabled ?? true,
  };

  // Migrate plaintext pinCode -> salted SHA-256 hash
  if (nextSettings.pinCode && !nextSettings.pinHash) {
    const creds = await createPinCredentials(nextSettings.pinCode);
    nextSettings = {
      ...nextSettings,
      pinHash: creds.pinHash,
      pinSalt: creds.pinSalt,
    };
    delete nextSettings.pinCode;
    changed = true;
  } else if ('pinCode' in nextSettings && nextSettings.pinCode !== undefined) {
    delete nextSettings.pinCode;
    changed = true;
  }

  return {
    cleanState: {
      ...rawState,
      settings: {
        ...nextSettings,
        planTier: nextSettings.planTier ?? 'free',
      },
      transactions: nextTransactions,
      rules: rawState.rules ?? [],
      investments: rawState.investments ?? [],
      sips: rawState.sips ?? [],
      policies: rawState.policies ?? [],
      emergencyInfo: rawState.emergencyInfo ?? {
        willLocation: '',
        bankLockerInfo: '',
        advisorContact: '',
        nomineeNotes: '',
      },
      auditLog: rawState.auditLog ?? [],
    },
    extractedReceipts,
    changed,
  };
}

export async function saveReceiptRecord(receipt: ReceiptRecord): Promise<void> {
  if (!hasIndexedDb()) {
    memoryReceipts.set(receipt.id, receipt);
    return;
  }
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_RECEIPTS, 'readwrite');
    tx.objectStore(STORE_RECEIPTS).put(receipt);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save receipt'));
  });
}

export async function getReceiptRecord(receiptId: string): Promise<ReceiptRecord | null> {
  if (!hasIndexedDb()) {
    return memoryReceipts.get(receiptId) ?? null;
  }
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RECEIPTS, 'readonly');
    const req = tx.objectStore(STORE_RECEIPTS).get(receiptId);
    req.onsuccess = () => resolve((req.result as ReceiptRecord | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error('Failed to load receipt'));
  });
}

export async function getAllReceiptRecords(): Promise<ReceiptRecord[]> {
  if (!hasIndexedDb()) {
    return Array.from(memoryReceipts.values());
  }
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RECEIPTS, 'readonly');
    const req = tx.objectStore(STORE_RECEIPTS).getAll();
    req.onsuccess = () => resolve((req.result as ReceiptRecord[]) ?? []);
    req.onerror = () => reject(req.error ?? new Error('Failed to list receipts'));
  });
}

export async function deleteReceiptRecord(receiptId: string): Promise<void> {
  if (!hasIndexedDb()) {
    memoryReceipts.delete(receiptId);
    return;
  }
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_RECEIPTS, 'readwrite');
    tx.objectStore(STORE_RECEIPTS).delete(receiptId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to delete receipt'));
  });
}

export async function clearAllReceiptRecords(): Promise<void> {
  if (!hasIndexedDb()) {
    memoryReceipts.clear();
    return;
  }
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_RECEIPTS, 'readwrite');
    tx.objectStore(STORE_RECEIPTS).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to clear receipts'));
  });
}

/**
 * Deletes any receipt blobs in IndexedDB/fallback that are no longer referenced
 * by any active transaction. Returns the number of purged orphan records.
 */
export async function purgeOrphanReceipts(
  activeTransactions: Array<{ receiptId?: string }>
): Promise<number> {
  const validIds = new Set(
    activeTransactions.map((t) => t.receiptId).filter((id): id is string => Boolean(id))
  );
  const allReceipts = await getAllReceiptRecords();
  let purged = 0;
  for (const rec of allReceipts) {
    if (!validIds.has(rec.id)) {
      await deleteReceiptRecord(rec.id);
      purged++;
    }
  }
  return purged;
}

export async function saveAppStateToRepo(
  state: AppState,
  householdId?: string
): Promise<void> {
  const { kvKey, lsKey } = resolveRepoKeys(householdId);
  const lightState = stripInlineReceipts(state);
  if (!hasIndexedDb()) {
    memoryKv.set(kvKey, lightState);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(lsKey, JSON.stringify(lightState));
      }
    } catch {
      // ignore quota
    }
    return;
  }

  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_KV, 'readwrite');
    tx.objectStore(STORE_KV).put(lightState, kvKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to persist state to IndexedDB'));
  });
}

export async function deleteAppStateFromRepo(householdId: string): Promise<void> {
  const { kvKey, lsKey } = resolveRepoKeys(householdId);
  memoryKv.delete(kvKey);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(lsKey);
    }
  } catch {
    // ignore
  }
  if (!hasIndexedDb()) return;
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_KV, 'readwrite');
    tx.objectStore(STORE_KV).delete(kvKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to delete household state'));
  });
}

export async function loadAppStateFromRepo(householdId?: string): Promise<{
  state: AppState | null;
  migratedFromLegacy: boolean;
}> {
  const { kvKey, lsKey } = resolveRepoKeys(householdId);
  if (hasIndexedDb()) {
    const db = await openDatabase();
    const idbState = await new Promise<AppState | null>((resolve, reject) => {
      const tx = db.transaction(STORE_KV, 'readonly');
      const req = tx.objectStore(STORE_KV).get(kvKey);
      req.onsuccess = () => resolve((req.result as AppState | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error('Failed to read IndexedDB state'));
    });

    if (idbState && Array.isArray(idbState.transactions) && Array.isArray(idbState.accounts)) {
      const { cleanState, extractedReceipts, changed } = await sanitizeAndMigrateState(idbState);
      for (const r of extractedReceipts) {
        await saveReceiptRecord(r);
      }
      if (changed) {
        await saveAppStateToRepo(cleanState, householdId);
      }
      return { state: cleanState, migratedFromLegacy: false };
    }
  } else {
    const memState = memoryKv.get(kvKey);
    if (memState) {
      return { state: memState, migratedFromLegacy: false };
    }
  }

  // Fallback / one-time migration from localStorage key
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(lsKey) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && Array.isArray(parsed.transactions) && Array.isArray(parsed.accounts)) {
        const { cleanState, extractedReceipts } = await sanitizeAndMigrateState(parsed);
        for (const r of extractedReceipts) {
          await saveReceiptRecord(r);
        }
        await saveAppStateToRepo(cleanState, householdId);
        if (hasIndexedDb()) {
          localStorage.removeItem(lsKey);
        }
        return { state: cleanState, migratedFromLegacy: hasIndexedDb() };
      }
    }
  } catch {
    // ignore corrupt localStorage
  }

  return { state: null, migratedFromLegacy: false };
}

export function resetMemoryFallbackForTests(): void {
  memoryKv.clear();
  memoryReceipts.clear();
}
