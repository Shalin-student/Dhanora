import React, { useEffect, useState } from 'react';
import {
  Cloud,
  Download,
  HardDrive,
  Lock,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import type {
  AppState,
  CurrencyCode,
  ReceiptRecord,
  ThemeMode,
} from '../types/finance';
import { CURRENCY_META } from '../utils/currency';
import { getAllReceiptRecords } from '../storage/repository';
import { formatBytes } from '../utils/image';
import { useI18n } from '../i18n/useI18n';
import { LanguageToggle } from '../components/LanguageToggle';

interface BackupPayload extends AppState {
  receipts?: ReceiptRecord[];
}

export const SettingsView: React.FC = () => {
  const {
    state,
    storageEngine,
    authSession,
    roleCapabilities,
    syncStatus,
    syncRevision,
    lastSyncedAt,
    syncNow,
    updateSettings,
    setHouseholdPin,
    disableHouseholdPin,
    deleteHouseholdAccount,
    restoreState,
    resetToDemo,
    clearAllData,
  } = useFinance();
  const { t, currencyName } = useI18n();

  const [restoreMsg, setRestoreMsg] = useState('');
  const [includeReceipts, setIncludeReceipts] = useState(true);
  const [receiptStats, setReceiptStats] = useState({ count: 0, totalBytes: 0 });

  // PIN management form
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [pinErr, setPinErr] = useState('');

  useEffect(() => {
    let active = true;
    getAllReceiptRecords()
      .then((records) => {
        if (!active) return;
        setReceiptStats({
          count: records.length,
          totalBytes: records.reduce((sum, r) => sum + r.sizeBytes, 0),
        });
      })
      .catch(() => {
        // ignore storage read errors
      });
    return () => {
      active = false;
    };
  }, [state.transactions]);

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinErr('');
    setPinMsg('');
    if (!/^\d{4,8}$/.test(newPin)) {
      setPinErr(t('set.pinErrLength'));
      return;
    }
    if (newPin !== confirmPin) {
      setPinErr(t('set.pinErrMatch'));
      return;
    }
    await setHouseholdPin(newPin);
    setNewPin('');
    setConfirmPin('');
    setPinMsg(t('set.pinMsgEnabled'));
  };

  const handleExportBackup = async () => {
    const receipts = includeReceipts ? await getAllReceiptRecords() : undefined;
    const payload: BackupPayload = includeReceipts ? { ...state, receipts } : state;
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hearthledger-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as BackupPayload;
        if (parsed && Array.isArray(parsed.transactions) && Array.isArray(parsed.accounts)) {
          const { receipts, ...appState } = parsed;
          void restoreState(appState, receipts);
          setRestoreMsg(
            t('set.restoreSuccess', {
              txCount: appState.transactions.length,
              rcptPart: receipts?.length
                ? t('set.restoreRcptPart', { count: receipts.length })
                : '',
            })
          );
        } else {
          setRestoreMsg(t('set.restoreInvalid'));
        }
      } catch {
        setRestoreMsg(t('set.restoreError'));
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {t('set.title')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('set.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* General & Currency */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t('set.householdSection')}
            </h2>
            <LanguageToggle variant="pill" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              {t('set.householdNameLabel')}
            </label>
            <input
              type="text"
              value={state.settings.householdName}
              onChange={(e) => updateSettings({ householdName: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                {t('set.baseCurrencyLabel')}
              </label>
              <select
                value={state.settings.baseCurrency}
                onChange={(e) =>
                  updateSettings({ baseCurrency: e.target.value as CurrencyCode })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {Object.entries(CURRENCY_META).map(([code, meta]) => (
                  <option key={code} value={code}>
                    {code} ({meta.symbol}) - {currencyName(code as CurrencyCode, meta.name)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                {t('set.themeModeLabel')}
              </label>
              <select
                value={state.settings.theme}
                onChange={(e) => updateSettings({ theme: e.target.value as ThemeMode })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="light">{t('set.themeLight')}</option>
                <option value="dark">{t('set.themeDark')}</option>
                <option value="system">{t('set.themeSystem')}</option>
              </select>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              {t('set.ratesHeading')}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(Object.keys(CURRENCY_META) as CurrencyCode[]).map((code) => (
                <div
                  key={code}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs dark:border-slate-700"
                >
                  <span className="font-bold">{code}</span>
                  <input
                    type="number"
                    step="0.01"
                    disabled={code === 'USD'}
                    value={state.settings.exchangeRates[code]}
                    onChange={(e) =>
                      updateSettings({
                        exchangeRates: {
                          ...state.settings.exchangeRates,
                          [code]: parseFloat(e.target.value) || 1,
                        },
                      })
                    }
                    className="w-16 bg-transparent text-right font-semibold focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Security & Data */}
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('set.pinSection')}
                </h2>
              </div>
              {state.settings.pinEnabled && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <ShieldCheck className="h-3 w-3" />
                  {t('set.shaActive')}
                </span>
              )}
            </div>

            {pinErr && (
              <div className="mb-2 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {pinErr}
              </div>
            )}
            {pinMsg && (
              <div className="mb-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                {pinMsg}
              </div>
            )}

            <form onSubmit={(e) => void handleSavePin(e)} className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder={
                    state.settings.pinEnabled
                      ? t('set.pinPlaceholderNew')
                      : t('set.pinPlaceholderSet')
                  }
                  aria-label={t('set.pinAriaNew')}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold tracking-widest dark:border-slate-700 dark:bg-slate-800"
                />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder={t('set.pinPlaceholderConfirm')}
                  aria-label={t('set.pinAriaConfirm')}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold tracking-widest dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {t('set.autoLockLabel')}
                  </label>
                  <select
                    aria-label={t('set.autoLockAria')}
                    value={state.settings.autoLockMinutes}
                    onChange={(e) =>
                      updateSettings({ autoLockMinutes: Number(e.target.value) || 0 })
                    }
                    className="rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value={0}>{t('set.off')}</option>
                    <option value={1}>{t('set.minN', { m: 1 })}</option>
                    <option value={5}>{t('set.minN', { m: 5 })}</option>
                    <option value={15}>{t('set.minN', { m: 15 })}</option>
                    <option value={30}>{t('set.minN', { m: 30 })}</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  {state.settings.pinEnabled && roleCapabilities.canDeleteHouseholdData && (
                    <button
                      type="button"
                      onClick={() => {
                        disableHouseholdPin();
                        setPinMsg('');
                      }}
                      className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300"
                    >
                      {t('set.disablePin')}
                    </button>
                  )}
                  <button
                    type="submit"
                    className="rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    {state.settings.pinEnabled ? t('set.updatePin') : t('set.enablePin')}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Multi-Device SQLite Sync */}
          <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('set.syncHeading')}
                </h2>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                  syncStatus === 'synced'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {syncStatus === 'synced'
                  ? t('set.syncedRevBadge', { rev: syncRevision })
                  : t(`set.syncState.${syncStatus}` as const)}
              </span>
            </div>

            <div className="space-y-2.5">
              <label className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold dark:bg-slate-800/60">
                <span>{t('set.syncEnableToggle')}</span>
                <input
                  type="checkbox"
                  checked={state.settings.syncEnabled !== false}
                  onChange={(e) => updateSettings({ syncEnabled: e.target.checked })}
                />
              </label>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={state.settings.syncServerUrl ?? ''}
                  onChange={(e) => updateSettings({ syncServerUrl: e.target.value })}
                  placeholder={t('set.syncUrlPlaceholder')}
                  aria-label={t('set.syncUrlAria')}
                  className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <input
                  type="password"
                  value={state.settings.syncKey ?? ''}
                  onChange={(e) => updateSettings({ syncKey: e.target.value })}
                  placeholder={t('set.syncKeyPlaceholder')}
                  aria-label={t('set.syncKeyAria')}
                  className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">
                  {lastSyncedAt
                    ? t('set.lastSynced', { time: new Date(lastSyncedAt).toLocaleTimeString() })
                    : t('set.serverHint')}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void syncNow(false)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {t('set.syncNow')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void syncNow(true)}
                    className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-slate-700"
                  >
                    {t('set.forcePush')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Storage Diagnostics & Backup */}
          <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('set.storageHeading')}
                </h2>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {storageEngine === 'indexeddb' ? 'IndexedDB' : t('rcpt.engineFallback')}
              </span>
            </div>

            <div className="mb-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center text-xs dark:bg-slate-800/60">
              <div>
                <div className="text-[11px] text-slate-500">{t('set.statTransactions')}</div>
                <div className="font-bold">{state.transactions.length}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">{t('set.statReceipts')}</div>
                <div className="font-bold">{receiptStats.count}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">{t('set.statSize')}</div>
                <div className="font-bold">{formatBytes(receiptStats.totalBytes)}</div>
              </div>
            </div>

            {restoreMsg && (
              <div className="mb-3 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
                {restoreMsg}
              </div>
            )}

            <label className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={includeReceipts}
                onChange={(e) => setIncludeReceipts(e.target.checked)}
              />
              {t('set.includeReceipts')}
            </label>

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => void handleExportBackup()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Download className="h-3.5 w-3.5" />
                {t('set.downloadJson')}
              </button>

              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                <Upload className="h-3.5 w-3.5" />
                {t('set.restoreJson')}
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleImportBackup}
                />
              </label>

              <button
                type="button"
                onClick={resetToDemo}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('set.loadDemo')}
              </button>

              {roleCapabilities.canDeleteHouseholdData && (
                <button
                  type="button"
                  onClick={clearAllData}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('set.clearBlank')}
                </button>
              )}
            </div>

            {roleCapabilities.canDeleteHouseholdData && authSession && !authSession.isDemo && (
              <div className="mt-5 border-t border-rose-200 pt-4 dark:border-rose-900/50">
                <div className="text-xs font-bold text-rose-700 dark:text-rose-400">
                  {t('set.dangerDeleteHeading')}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {t('set.dangerDeleteDesc')}
                </p>
                <button
                  type="button"
                  onClick={() => void deleteHouseholdAccount()}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('set.deleteAccountBtn')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
