import React, { useEffect, useMemo, useState } from 'react';
import { Eye, FileImage, HardDrive, Search, Trash2, Upload } from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import type { ReceiptRecord } from '../types/finance';
import { getAllReceiptRecords } from '../storage/repository';
import { formatMoney } from '../utils/currency';
import { formatBytes, processReceiptFile } from '../utils/image';
import { useI18n } from '../i18n/useI18n';

export const ReceiptsView: React.FC = () => {
  const {
    state,
    storageEngine,
    selectedMemberId,
    openReceiptPreview,
    getReceiptWithSync,
    attachReceiptToTransaction,
    removeReceiptFromTransaction,
  } = useFinance();
  const { t, memName } = useI18n();

  const [records, setRecords] = useState<ReceiptRecord[]>([]);
  const [filterMode, setFilterMode] = useState<'with' | 'missing' | 'all'>('with');
  const [search, setSearch] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(12);

  const refreshRecords = async () => {
    const all = await getAllReceiptRecords();
    const byId = new Set(all.map((r) => r.id));
    const missingRemoteIds = state.transactions
      .map((tx) => tx.receiptId)
      .filter((id): id is string => Boolean(id) && !byId.has(id!));
    if (missingRemoteIds.length > 0) {
      const fetched = await Promise.all(
        missingRemoteIds.slice(0, 12).map((id) => getReceiptWithSync(id))
      );
      for (const rec of fetched) {
        if (rec) all.push(rec);
      }
    }
    setRecords(all);
  };

  useEffect(() => {
    void refreshRecords();
  }, [state.transactions]);

  const recordMap = useMemo(() => new Map(records.map((r) => [r.id, r])), [records]);

  const totalBytes = useMemo(
    () => records.reduce((sum, r) => sum + r.sizeBytes, 0),
    [records]
  );

  const visibleTxs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.transactions
      .filter((tx) => {
        if (selectedMemberId !== 'all' && tx.memberId !== selectedMemberId) return false;
        if (filterMode === 'with' && !tx.receiptId) return false;
        if (filterMode === 'missing' && (tx.receiptId || tx.type !== 'expense' || tx.baseAmount < 50)) {
          return false;
        }
        if (q) {
          const hay = `${tx.merchant} ${tx.receiptName ?? ''} ${tx.note}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [state.transactions, selectedMemberId, filterMode, search]);

  useEffect(() => {
    setVisibleLimit(12);
  }, [filterMode, search, selectedMemberId]);

  const pagedTxs = useMemo(
    () => visibleTxs.slice(0, visibleLimit),
    [visibleTxs, visibleLimit]
  );

  const missingHighSpendCount = useMemo(
    () =>
      state.transactions.filter(
        (tx) => tx.type === 'expense' && tx.baseAmount >= 50 && !tx.receiptId
      ).length,
    [state.transactions]
  );

  const handleAttachDirect = async (txId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const processed = await processReceiptFile(file);
    await attachReceiptToTransaction(txId, processed);
    await refreshRecords();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {t('rcpt.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('rcpt.subtitlePrefix')}{' '}
            <span className="font-semibold">
              {storageEngine === 'indexeddb' ? t('rcpt.engineIdb') : t('rcpt.engineFallback')}
            </span>{' '}
            {t('rcpt.subtitleSuffix')}
          </p>
        </div>
      </div>

      {/* Vault Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{t('rcpt.archivedCount')}</span>
            <FileImage className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
            {records.length}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{t('rcpt.storageUsed')}</span>
            <HardDrive className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
            {formatBytes(totalBytes)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-semibold text-slate-500">
            {t('rcpt.missingHighSpend')}
          </div>
          <div className="mt-1 text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {missingHighSpendCount}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(
            [
              ['with', t('rcpt.tabWith')],
              ['missing', t('rcpt.tabMissing')],
              ['all', t('rcpt.tabAll')],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilterMode(mode)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filterMode === mode
                  ? 'bg-white text-blue-600 shadow-2xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('rcpt.searchPlaceholder')}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      </div>

      {/* Grid */}
      {visibleTxs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <FileImage className="mx-auto mb-2 h-8 w-8 text-slate-400" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {t('rcpt.emptyTitle')}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {t('rcpt.emptySub')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pagedTxs.map((tx) => {
              const rec = tx.receiptId ? recordMap.get(tx.receiptId) : undefined;
              const mem = state.members.find((m) => m.id === tx.memberId);

              return (
                <div
                  key={tx.id}
                  className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900"
                >
                  {rec && rec.mimeType.startsWith('image/') ? (
                    <button
                      type="button"
                      onClick={() => openReceiptPreview(tx.id)}
                      className="group relative h-44 w-full overflow-hidden bg-slate-100 dark:bg-slate-800"
                    >
                      <img
                        src={rec.dataUrl}
                        alt={t('lightbox.title', { merchant: tx.merchant })}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                      <span className="absolute right-2 bottom-2 rounded-lg bg-slate-950/75 px-2 py-1 text-[10px] font-semibold text-white">
                        {formatBytes(rec.sizeBytes)}
                      </span>
                    </button>
                  ) : (
                    <div className="flex h-28 items-center justify-center bg-slate-50 text-xs text-slate-400 dark:bg-slate-800/60">
                      {rec ? rec.fileName : t('rcpt.noReceiptAttached')}
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                          {tx.merchant}
                        </h2>
                        <p className="text-xs text-slate-500">
                          {tx.date} • {mem?.avatar} {memName(mem)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-extrabold text-slate-900 dark:text-white">
                        {formatMoney(tx.amount, tx.currency, state.settings.privacyMode)}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                      {tx.receiptId ? (
                        <>
                          <button
                            type="button"
                            onClick={() => openReceiptPreview(tx.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {t('rcpt.inspect')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeReceiptFromTransaction(tx.id)}
                            className="inline-flex items-center gap-1 rounded-lg p-1.5 text-xs text-slate-400 hover:text-rose-600"
                            aria-label={t('rcpt.removeReceipt', { merchant: tx.merchant })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <label className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                          <Upload className="h-3.5 w-3.5" />
                          {t('rcpt.attachReceipt')}
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) => void handleAttachDirect(tx.id, e)}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {visibleTxs.length > visibleLimit && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setVisibleLimit((n) => n + 12)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('rcpt.loadMore', { count: visibleTxs.length - visibleLimit })}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
