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
    link.download = `dhanora-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
        <h1 className="text-2xl font-bold tracking-tight text-[#131b2e] dark:text-white">
          {t('set.title')}
        </h1>
        <p className="text-sm text-[#404944] dark:text-[#707974]">
          {t('set.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* General & Currency */}
        <div className="space-y-4 wdw-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-[#131b2e] dark:text-white">
              {t('set.householdSection')}
            </h2>
            <LanguageToggle variant="pill" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#404944] dark:text-[#bfc9c3]">
              {t('set.householdNameLabel')}
            </label>
            <input
              type="text"
              value={state.settings.householdName}
              onChange={(e) => updateSettings({ householdName: e.target.value })}
              className="w-full rounded-xl border border-[#CBD5E1] px-3 py-2 text-sm dark:border-[#2f3b52] dark:bg-[#172036]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#404944] dark:text-[#bfc9c3]">
                {t('set.baseCurrencyLabel')}
              </label>
              <select
                value={state.settings.baseCurrency}
                onChange={(e) =>
                  updateSettings({ baseCurrency: e.target.value as CurrencyCode })
                }
                className="w-full rounded-xl border border-[#CBD5E1] px-3 py-2 text-sm dark:border-[#2f3b52] dark:bg-[#172036]"
              >
                {Object.entries(CURRENCY_META).map(([code, meta]) => (
                  <option key={code} value={code}>
                    {code} ({meta.symbol}) - {currencyName(code as CurrencyCode, meta.name)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#404944] dark:text-[#bfc9c3]">
                {t('set.themeModeLabel')}
              </label>
              <select
                value={state.settings.theme}
                onChange={(e) => updateSettings({ theme: e.target.value as ThemeMode })}
                className="w-full rounded-xl border border-[#CBD5E1] px-3 py-2 text-sm dark:border-[#2f3b52] dark:bg-[#172036]"
              >
                <option value="light">{t('set.themeLight')}</option>
                <option value="dark">{t('set.themeDark')}</option>
                <option value="system">{t('set.themeSystem')}</option>
              </select>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold text-[#404944] dark:text-[#bfc9c3]">
              {t('set.ratesHeading')}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(Object.keys(CURRENCY_META) as CurrencyCode[]).map((code) => (
                <div
                  key={code}
                  className="flex items-center justify-between rounded-xl border border-[#bfc9c3]/60 px-2.5 py-1.5 text-xs dark:border-[#2f3b52]"
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
        <div className="space-y-5 wdw-card p-5">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-[#0F766E]" />
                <h2 className="text-base font-bold text-[#131b2e] dark:text-white">
                  {t('set.pinSection')}
                </h2>
              </div>
              {state.settings.pinEnabled && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#b0f0d6]/60 px-2.5 py-0.5 text-[10px] font-bold text-[#064E3B] dark:bg-emerald-950 dark:text-emerald-300">
                  <ShieldCheck className="h-3 w-3" />
                  {t('set.shaActive')}
                </span>
              )}
            </div>

            {pinErr && (
              <div className="mb-2 rounded-lg bg-[#ffdad6]/70 px-3 py-1.5 text-xs font-semibold text-[#93000a] dark:bg-rose-950/40 dark:text-rose-300">
                {pinErr}
              </div>
            )}
            {pinMsg && (
              <div className="mb-2 rounded-lg bg-[#b0f0d6]/35 px-3 py-1.5 text-xs font-semibold text-[#064E3B] dark:bg-emerald-950/40 dark:text-emerald-300">
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
                  className="rounded-xl border border-[#CBD5E1] px-3 py-2 text-xs font-semibold tracking-widest dark:border-[#2f3b52] dark:bg-[#172036]"
                />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder={t('set.pinPlaceholderConfirm')}
                  aria-label={t('set.pinAriaConfirm')}
                  className="rounded-xl border border-[#CBD5E1] px-3 py-2 text-xs font-semibold tracking-widest dark:border-[#2f3b52] dark:bg-[#172036]"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-[#404944] dark:text-[#bfc9c3]">
                    {t('set.autoLockLabel')}
                  </label>
                  <select
                    aria-label={t('set.autoLockAria')}
                    value={state.settings.autoLockMinutes}
                    onChange={(e) =>
                      updateSettings({ autoLockMinutes: Number(e.target.value) || 0 })
                    }
                    className="rounded-xl border border-[#CBD5E1] px-2.5 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
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
                      className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-semibold text-[#93000a] hover:bg-[#ffdad6]/70 dark:border-rose-900 dark:text-rose-300"
                    >
                      {t('set.disablePin')}
                    </button>
                  )}
                  <button
                    type="submit"
                    className="rounded-xl bg-[#064E3B] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#043D2E]"
                  >
                    {state.settings.pinEnabled ? t('set.updatePin') : t('set.enablePin')}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Multi-Device SQLite Sync */}
          <div className="border-t border-[#F1F5F9] pt-4 dark:border-[#232f4f]">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-[#0F766E]" />
                <h2 className="text-base font-bold text-[#131b2e] dark:text-white">
                  {t('set.syncHeading')}
                </h2>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                  syncStatus === 'synced'
                    ? 'bg-[#b0f0d6]/60 text-[#064E3B] dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-[#eaedff] text-[#404944] dark:bg-[#172036] dark:text-[#bfc9c3]'
                }`}
              >
                {syncStatus === 'synced'
                  ? t('set.syncedRevBadge', { rev: syncRevision })
                  : t(`set.syncState.${syncStatus}` as const)}
              </span>
            </div>

            <div className="space-y-2.5">
              <label className="flex items-center justify-between rounded-xl bg-[#f2f3ff] px-3 py-2 text-xs font-semibold dark:bg-[#1c2640]">
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
                  className="rounded-xl border border-[#CBD5E1] px-3 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
                />
                <input
                  type="password"
                  value={state.settings.syncKey ?? ''}
                  onChange={(e) => updateSettings({ syncKey: e.target.value })}
                  placeholder={t('set.syncKeyPlaceholder')}
                  aria-label={t('set.syncKeyAria')}
                  className="rounded-xl border border-[#CBD5E1] px-3 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-[#404944]">
                  {lastSyncedAt
                    ? t('set.lastSynced', { time: new Date(lastSyncedAt).toLocaleTimeString() })
                    : t('set.serverHint')}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void syncNow(false)}
                    className="inline-flex items-center gap-1 rounded-xl border border-[#bfc9c3]/60 px-3 py-1.5 text-xs font-semibold hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:hover:bg-[#1c2640]"
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
          <div className="border-t border-[#F1F5F9] pt-4 dark:border-[#232f4f]">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-[#10B981]" />
                <h2 className="text-base font-bold text-[#131b2e] dark:text-white">
                  {t('set.storageHeading')}
                </h2>
              </div>
              <span className="rounded-full bg-[#eaedff] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#404944] dark:bg-[#172036] dark:text-[#bfc9c3]">
                {storageEngine === 'indexeddb' ? 'IndexedDB' : t('rcpt.engineFallback')}
              </span>
            </div>

            <div className="mb-3 grid grid-cols-3 gap-2 rounded-xl bg-[#f2f3ff] p-3 text-center text-xs dark:bg-[#1c2640]">
              <div>
                <div className="text-[11px] text-[#404944]">{t('set.statTransactions')}</div>
                <div className="font-bold">{state.transactions.length}</div>
              </div>
              <div>
                <div className="text-[11px] text-[#404944]">{t('set.statReceipts')}</div>
                <div className="font-bold">{receiptStats.count}</div>
              </div>
              <div>
                <div className="text-[11px] text-[#404944]">{t('set.statSize')}</div>
                <div className="font-bold">{formatBytes(receiptStats.totalBytes)}</div>
              </div>
            </div>

            {restoreMsg && (
              <div className="mb-3 rounded-xl bg-[#f2f3ff] px-3 py-2 text-xs font-semibold text-[#003430] dark:bg-[#004d47]/40 dark:text-[#b0f0d6]">
                {restoreMsg}
              </div>
            )}

            <label className="mb-3 flex items-center gap-2 text-xs font-medium text-[#404944] dark:text-[#bfc9c3]">
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
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#064E3B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#043D2E]"
              >
                <Download className="h-3.5 w-3.5" />
                {t('set.downloadJson')}
              </button>

              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#bfc9c3]/60 px-3.5 py-2 text-xs font-semibold hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:hover:bg-[#1c2640]">
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
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#bfc9c3]/60 px-3.5 py-2 text-xs font-semibold text-[#131b2e] hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:text-[#eef0ff] dark:hover:bg-[#1c2640]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('set.loadDemo')}
              </button>

              {roleCapabilities.canDeleteHouseholdData && (
                <button
                  type="button"
                  onClick={clearAllData}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-[#ffdad6]/70 px-3.5 py-2 text-xs font-semibold text-[#93000a] hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('set.clearBlank')}
                </button>
              )}
            </div>

            {roleCapabilities.canDeleteHouseholdData && authSession && !authSession.isDemo && (
              <div className="mt-5 border-t border-rose-200 pt-4 dark:border-rose-900/50">
                <div className="text-xs font-bold text-[#93000a] dark:text-rose-400">
                  {t('set.dangerDeleteHeading')}
                </div>
                <p className="mt-0.5 text-[11px] text-[#404944] dark:text-[#707974]">
                  {t('set.dangerDeleteDesc')}
                </p>
                <button
                  type="button"
                  onClick={() => void deleteHouseholdAccount()}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-[#ba1a1a] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#93000a]"
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
