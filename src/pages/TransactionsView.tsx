import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Edit3,
  FileImage,
  Plus,
  Search,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import type { TransactionStatus, TransactionType } from '../types/finance';
import { formatMoney } from '../utils/currency';
import {
  detectCsvDuplicates,
  exportTransactionsToCsv,
  mapCsvRowsToTransactions,
  parseCsvText,
} from '../utils/csv';
import { MemberRoleAvatar } from '../components/WdwPrimitives';
import { useI18n } from '../i18n/useI18n';

const PAGE_SIZE = 20;

export const TransactionsView: React.FC = () => {
  const {
    state,
    selectedMonth,
    selectedMemberId,
    openQuickAdd,
    openReceiptPreview,
    toggleTransactionStatus,
    markTransactionsStatus,
    deleteTransactions,
    importTransactions,
    upsertCsvPreset,
    deleteCsvPreset,
  } = useFinance();
  const { language, t, catName, accName, memName, entityText, txStatusLabel } = useI18n();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TransactionStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [monthScope, setMonthScope] = useState<'selected' | 'all'>('selected');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'merchant'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');

  // CSV Import Modal state
  const [csvRows, setCsvRows] = useState<string[][] | null>(null);
  const [csvImportCount, setCsvImportCount] = useState<string | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [presetName, setPresetName] = useState('');
  const [mapping, setMapping] = useState({
    dateCol: 0,
    merchantCol: 1,
    amountCol: 2,
    typeCol: -1,
    categoryCol: -1,
    noteCol: -1,
  });

  const csvPreview = useMemo(() => {
    if (!csvRows || csvRows.length < 2) return null;
    const candidates = mapCsvRowsToTransactions(csvRows.slice(1), mapping, {
      accountId: state.accounts[0]?.id ?? 'acc-joint',
      memberId:
        selectedMemberId === 'all'
          ? state.members[0]?.id ?? 'm-shared'
          : selectedMemberId,
      baseCurrency: state.settings.baseCurrency,
      exchangeRates: state.settings.exchangeRates,
      categories: state.categories,
      rules: state.rules ?? [],
    });
    return detectCsvDuplicates(candidates, state.transactions);
  }, [
    csvRows,
    mapping,
    state.accounts,
    state.members,
    state.settings.baseCurrency,
    state.settings.exchangeRates,
    state.categories,
    state.rules,
    state.transactions,
    selectedMemberId,
  ]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const factor = sortDir === 'asc' ? 1 : -1;
    return state.transactions
      .filter((tx) => {
        if (monthScope === 'selected' && !tx.date.startsWith(selectedMonth)) return false;
        if (selectedMemberId !== 'all' && tx.memberId !== selectedMemberId) return false;
        if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
        if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
        if (categoryFilter !== 'all' && tx.categoryId !== categoryFilter) return false;
        if (accountFilter !== 'all' && tx.accountId !== accountFilter) return false;
        if (q) {
          const hay = `${tx.merchant} ${tx.note} ${tx.tags.join(' ')}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'amount') return (a.baseAmount - b.baseAmount) * factor;
        if (sortBy === 'merchant') return a.merchant.localeCompare(b.merchant) * factor;
        const dateCmp = a.date.localeCompare(b.date);
        return (dateCmp !== 0 ? dateCmp : a.createdAt.localeCompare(b.createdAt)) * factor;
      });
  }, [
    state.transactions,
    selectedMonth,
    selectedMemberId,
    monthScope,
    typeFilter,
    statusFilter,
    categoryFilter,
    accountFilter,
    search,
    sortBy,
    sortDir,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [
    selectedMonth,
    selectedMemberId,
    monthScope,
    typeFilter,
    statusFilter,
    categoryFilter,
    accountFilter,
    search,
    sortBy,
    sortDir,
  ]);

  const paginatedRows = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  );

  const handleSortClick = (field: 'date' | 'amount' | 'merchant') => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortDir(field === 'merchant' ? 'asc' : 'desc');
    }
  };

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of filtered) {
      if (tx.type === 'income') income += tx.baseAmount;
      else if (tx.type === 'expense') expense += tx.baseAmount;
    }
    return { income, expense, net: income - expense };
  }, [filtered]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((tx) => tx.id));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    deleteTransactions(selectedIds);
    setSelectedIds([]);
  };

  const handleBulkClear = () => {
    if (selectedIds.length === 0) return;
    markTransactionsStatus(selectedIds, 'cleared');
    setSelectedIds([]);
  };

  const handleExportCsv = () => {
    const csv = exportTransactionsToCsv(
      filtered,
      state.categories,
      state.accounts,
      state.members,
      language
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dhanora-transactions-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsvText(String(reader.result));
      if (parsed.length > 1) {
        setCsvRows(parsed);
        setCsvImportCount(null);
      }
    };
    reader.readAsText(file);
  };

  const confirmCsvImport = () => {
    if (!csvPreview) return;
    const toImport = skipDuplicates
      ? csvPreview.unique
      : [...csvPreview.unique, ...csvPreview.duplicates];
    importTransactions(toImport);
    setCsvRows(null);
    setCsvImportCount(
      t('tx.importedMsg', {
        count: toImport.length,
        dupNote:
          skipDuplicates && csvPreview.duplicates.length > 0
            ? t('tx.dupsSkippedNote', { dups: csvPreview.duplicates.length })
            : '',
      })
    );
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    upsertCsvPreset({
      id: `preset-${Date.now()}`,
      name: presetName.trim(),
      ...mapping,
    });
    setPresetName('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#131b2e] sm:text-[32px] sm:leading-[40px] dark:text-white">
            {t('tx.title')}
          </h1>
          <p className="text-sm text-[#404944] dark:text-[#bfc9c3]">
            {t('tx.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-lg border border-[#bfc9c3]/70 bg-white px-3 py-2 text-xs font-semibold text-[#131b2e] hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:bg-[#131b2e] dark:text-[#eef0ff] dark:hover:bg-[#1c2640]">
            <Upload className="h-3.5 w-3.5" />
            {t('tx.importCsv')}
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvFile} />
          </label>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#bfc9c3]/70 bg-white px-3 py-2 text-xs font-semibold text-[#131b2e] hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:bg-[#131b2e] dark:text-[#eef0ff] dark:hover:bg-[#1c2640]"
          >
            <Download className="h-3.5 w-3.5" />
            {t('tx.exportCsv')}
          </button>
          <button
            type="button"
            onClick={() => openQuickAdd(null)}
            className="wdw-btn-primary inline-flex min-h-[40px] items-center gap-1.5 px-4 py-2 text-xs font-semibold shadow-sm"
          >
            <Plus className="h-4 w-4" />
            {t('tx.addEntry')}
          </button>
        </div>
      </div>

      {csvImportCount && (
        <div className="rounded-lg border border-[#10B981]/30 bg-[#b0f0d6]/30 px-4 py-2.5 text-xs font-semibold text-[#064E3B] dark:border-[#0F766E] dark:bg-[#064E3B]/40 dark:text-[#b0f0d6]">
          {csvImportCount}
        </div>
      )}

      {/* CSV Mapper */}
      {csvRows && (
        <div className="wdw-card-elevated rounded-2xl border border-[#0F766E]/25 bg-[#f2f3ff] p-4 dark:border-[#0F766E]/40 dark:bg-[#172036]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-[#003430] dark:text-[#9cf2e8]">
                {t('tx.mapCsvTitle', { count: csvRows.length - 1 })}
              </h2>
              {csvPreview && (
                <p className="font-numeric text-xs text-[#0F766E] dark:text-[#6ac0b6]">
                  <strong>{csvPreview.unique.length}</strong> {t('tx.csvPreviewNew')} •{' '}
                  <strong className={csvPreview.duplicates.length > 0 ? 'text-[#D97706]' : ''}>
                    {csvPreview.duplicates.length}
                  </strong>{' '}
                  {t('tx.csvPreviewDups')}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(state.settings.csvPresets ?? []).length > 0 && (
                <div className="flex items-center gap-1.5">
                  <select
                    aria-label={t('tx.loadPresetPlaceholder')}
                    value={selectedPresetId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedPresetId(nextId);
                      const preset = (state.settings.csvPresets ?? []).find(
                        (p) => p.id === nextId
                      );
                      if (preset) {
                        setMapping({
                          dateCol: preset.dateCol,
                          merchantCol: preset.merchantCol,
                          amountCol: preset.amountCol,
                          typeCol: preset.typeCol,
                          categoryCol: preset.categoryCol,
                          noteCol: preset.noteCol,
                        });
                      }
                    }}
                    className="rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs dark:border-[#2f3b52] dark:bg-[#131b2e]"
                  >
                    <option value="">{t('tx.loadPresetPlaceholder')}</option>
                    {(state.settings.csvPresets ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {selectedPresetId && (
                    <button
                      type="button"
                      onClick={() => {
                        deleteCsvPreset(selectedPresetId);
                        setSelectedPresetId('');
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#ba1a1a]/30 bg-white px-2 py-1 text-[11px] font-semibold text-[#ba1a1a] hover:bg-[#ffdad6]"
                      aria-label={t('tx.deletePreset')}
                    >
                      <Trash2 className="h-3 w-3" />
                      {t('tx.deletePreset')}
                    </button>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => setCsvRows(null)}
                className="text-xs font-semibold text-[#404944] hover:underline"
              >
                {t('layout.cancel')}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(
              [
                [t('tx.colDate'), 'dateCol'],
                [t('tx.colMerchant'), 'merchantCol'],
                [t('tx.colAmount'), 'amountCol'],
                [t('tx.colType'), 'typeCol'],
                [t('tx.colCategory'), 'categoryCol'],
                [t('tx.colNote'), 'noteCol'],
              ] as const
            ).map(([label, key]) => (
              <div key={key}>
                <label className="mb-1 block text-[11px] font-semibold text-[#404944] dark:text-[#bfc9c3]">
                  {label}
                </label>
                <select
                  value={mapping[key]}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [key]: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#131b2e]"
                >
                  <option value={-1}>{t('tx.none')}</option>
                  {csvRows[0].map((colName, idx) => (
                    <option key={idx} value={idx}>
                      {colName || t('tx.columnN', { n: idx + 1 })}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#131b2e] dark:text-[#eef0ff]">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="accent-[#064E3B]"
                />
                {t('tx.skipDuplicates')}
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder={t('tx.presetPlaceholder')}
                  className="w-36 rounded-lg border border-[#CBD5E1] bg-white px-2 py-1 text-xs dark:border-[#2f3b52] dark:bg-[#131b2e]"
                />
                <button
                  type="button"
                  onClick={handleSavePreset}
                  className="wdw-btn-secondary px-2.5 py-1 text-xs font-semibold"
                >
                  {t('tx.savePreset')}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={confirmCsvImport}
              className="wdw-btn-primary px-4 py-1.5 text-xs font-semibold"
            >
              {t('tx.confirmImport')}
            </button>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="wdw-card grid grid-cols-1 gap-3 p-4 md:grid-cols-12">
        <div className="relative md:col-span-4">
          <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-[#707974]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('tx.searchPlaceholder')}
            className="min-h-[40px] w-full rounded-lg border border-[#CBD5E1] bg-white py-2 pr-3 pl-9 text-xs text-[#131b2e] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-white"
          />
        </div>
        <div className="md:col-span-2">
          <select
            value={monthScope}
            onChange={(e) => setMonthScope(e.target.value as 'selected' | 'all')}
            className="min-h-[40px] w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#131b2e] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-white"
          >
            <option value="selected">{t('tx.selectedMonth')}</option>
            <option value="all">{t('tx.allTime')}</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | TransactionType)}
            className="min-h-[40px] w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#131b2e] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-white"
          >
            <option value="all">{t('tx.allTypes')}</option>
            <option value="income">{t('tx.income')}</option>
            <option value="expense">{t('tx.expense')}</option>
            <option value="transfer">{t('tx.transfer')}</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <select
            aria-label={t('tx.thStatus')}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | TransactionStatus)}
            className="min-h-[40px] w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#131b2e] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-white"
          >
            <option value="all">{t('tx.statusAll')}</option>
            <option value="cleared">{t('tx.statusCleared')}</option>
            <option value="pending">{t('tx.statusPending')}</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="min-h-[40px] w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#131b2e] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-white"
          >
            <option value="all">{t('tx.allCategories')}</option>
            {state.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {catName(c)}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3">
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="min-h-[40px] w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#131b2e] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-white"
          >
            <option value="all">{t('tx.allAccounts')}</option>
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {accName(a)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 md:col-span-9 md:justify-end">
          <span className="text-[11px] font-semibold text-[#404944] dark:text-[#bfc9c3]">{t('tx.sortLabel')}</span>
          {(
            [
              ['date', t('tx.sortDate')],
              ['amount', t('tx.sortAmount')],
              ['merchant', t('tx.sortMerchant')],
            ] as const
          ).map(([field, label]) => (
            <button
              key={field}
              type="button"
              onClick={() => handleSortClick(field)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                sortBy === field
                  ? 'border-[#064E3B] bg-[#064E3B]/10 text-[#064E3B] dark:border-[#80bea6] dark:bg-[#064E3B]/50 dark:text-[#b0f0d6]'
                  : 'border-[#bfc9c3]/70 bg-[#f2f3ff] text-[#404944] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-[#bfc9c3]'
              }`}
            >
              <ArrowUpDown className="h-3 w-3" />
              {label} {sortBy === field ? (sortDir === 'desc' ? '↓' : '↑') : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Summary strip + bulk action */}
      <div className="wdw-surface-tier flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-xs">
        <div className="font-numeric flex flex-wrap items-center gap-4">
          <span className="font-semibold text-[#404944] dark:text-[#bfc9c3]">
            {t('tx.showingEntries', { count: filtered.length })}
          </span>
          <span className="font-bold text-[#10B981]">
            {t('tx.inPrefix')} {formatMoney(totals.income, state.settings.baseCurrency, state.settings.privacyMode)}
          </span>
          <span className="font-bold text-[#904d00] dark:text-[#fe932c]">
            {t('tx.outPrefix')} {formatMoney(totals.expense, state.settings.baseCurrency, state.settings.privacyMode)}
          </span>
          <span className="font-bold text-[#0F766E] dark:text-[#6ac0b6]">
            {t('tx.netPrefix')} {formatMoney(totals.net, state.settings.baseCurrency, state.settings.privacyMode)}
          </span>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleBulkClear}
              className="wdw-btn-primary inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t('tx.markClearedBulk', { count: selectedIds.length })}
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-1 rounded-lg bg-[#ba1a1a] px-3 py-1 text-xs font-semibold text-white hover:bg-[#93000a]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t('tx.deleteSelected', { count: selectedIds.length })}
            </button>
          </div>
        )}
      </div>

      {/* Ledger Table */}
      <div className="wdw-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="label-caps border-b border-[#F1F5F9] bg-[#f2f3ff] text-[#404944] dark:border-[#232f4f] dark:bg-[#172036] dark:text-[#bfc9c3]">
              <tr>
                <th className="w-8 px-3 py-3">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    aria-label={t('tx.selectAll')}
                  >
                    {selectedIds.length === filtered.length && filtered.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-[#064E3B] dark:text-[#b0f0d6]" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="px-3 py-3">{t('tx.thDate')}</th>
                <th className="px-3 py-3">{t('tx.thMerchant')}</th>
                <th className="px-3 py-3">{t('tx.thCategory')}</th>
                <th className="px-3 py-3">{t('tx.thMember')}</th>
                <th className="px-3 py-3">{t('tx.thAccount')}</th>
                <th className="px-3 py-3">{t('tx.thStatus')}</th>
                <th className="px-3 py-3 text-right">{t('tx.thAmount')}</th>
                <th className="px-3 py-3 text-right">{t('tx.thActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#232f4f]">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-[#404944] dark:text-[#bfc9c3]">
                    {t('tx.emptyTable')}
                  </td>
                </tr>
              ) : (
                paginatedRows.map((tx) => {
                  const cat = state.categories.find((c) => c.id === tx.categoryId);
                  const mem = state.members.find((m) => m.id === tx.memberId);
                  const acc = state.accounts.find((a) => a.id === tx.accountId);
                  const toAcc = tx.toAccountId
                    ? state.accounts.find((a) => a.id === tx.toAccountId)
                    : undefined;
                  const checked = selectedIds.includes(tx.id);

                  return (
                    <tr
                      key={tx.id}
                      className="transition hover:bg-[#f2f3ff]/60 dark:hover:bg-[#1c2640]/50"
                    >
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => toggleSelect(tx.id)}
                          aria-label={t('tx.selectItem', { merchant: tx.merchant })}
                        >
                          {checked ? (
                            <CheckSquare className="h-4 w-4 text-[#064E3B] dark:text-[#b0f0d6]" />
                          ) : (
                            <Square className="h-4 w-4 text-[#707974]" />
                          )}
                        </button>
                      </td>
                      <td className="font-numeric whitespace-nowrap px-3 py-3 font-medium text-[#404944] dark:text-[#bfc9c3]">
                        {tx.date}
                      </td>
                      <td className="max-w-[240px] px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm ${
                              tx.type === 'income'
                                ? 'bg-[#064E3B]/10 dark:bg-[#064E3B]/40'
                                : 'bg-[#FEF3C7] dark:bg-[#904d00]/35'
                            }`}
                          >
                            {cat?.icon ?? '💳'}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-[#131b2e] dark:text-white">
                              {entityText(tx.merchant)}
                            </div>
                            <div className="flex flex-wrap items-center gap-1 text-[11px] text-[#404944] dark:text-[#bfc9c3]">
                              {tx.note && <span className="max-w-[160px] truncate">{tx.note}</span>}
                              {tx.categorySplits && tx.categorySplits.length > 0 && (
                                <span className="rounded-full bg-[#0F766E]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#0F766E] dark:text-[#6ac0b6]">
                                  {t('tx.splitBadge', { count: tx.categorySplits.length })}
                                </span>
                              )}
                              {tx.memberSplits && tx.memberSplits.length > 0 && (
                                <span className="rounded-full bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-semibold text-[#904d00]">
                                  {t('tx.sharedBadge')}
                                </span>
                              )}
                              {tx.receiptId && (
                                <button
                                  type="button"
                                  onClick={() => openReceiptPreview(tx.id)}
                                  className="inline-flex items-center gap-0.5 rounded-full bg-[#b0f0d6]/50 px-1.5 py-0.5 text-[10px] font-semibold text-[#064E3B] hover:bg-[#b0f0d6]"
                                >
                                  <FileImage className="h-2.5 w-2.5" />
                                  {t('tx.receiptBadge')}
                                </button>
                              )}
                              {tx.tags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-[#f2f3ff] px-1.5 py-0.5 text-[10px] dark:bg-[#1c2640]"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {tx.type === 'transfer' ? (
                          <span className="rounded-full bg-[#0F766E]/10 px-2.5 py-0.5 font-medium text-[#0F766E] dark:text-[#6ac0b6]">
                            {t('tx.transferBadge')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#064E3B]/8 px-2.5 py-0.5 text-[11px] font-medium text-[#064E3B] dark:bg-[#064E3B]/45 dark:text-[#b0f0d6]">
                            {catName(cat)}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <MemberRoleAvatar
                            avatar={mem?.avatar}
                            role={mem?.role}
                            name={memName(mem)}
                            size="xs"
                          />
                          <span>{memName(mem)}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[#404944] dark:text-[#bfc9c3]">
                        {accName(acc)}
                        {toAcc ? ` → ${accName(toAcc)}` : ''}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <button
                          type="button"
                          onClick={() => toggleTransactionStatus(tx.id)}
                          aria-label={t('tx.toggleStatusAria', { merchant: tx.merchant })}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition ${
                            tx.status === 'cleared'
                              ? 'bg-[#b0f0d6]/50 text-[#064E3B] hover:bg-[#b0f0d6] dark:bg-[#064E3B]/50 dark:text-[#b0f0d6]'
                              : 'bg-[#FEF3C7] text-[#904d00] hover:bg-[#fde68a]'
                          }`}
                        >
                          {tx.status === 'cleared' ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          {txStatusLabel(tx.status)}
                        </button>
                      </td>
                      <td
                        className={`font-numeric whitespace-nowrap px-3 py-3 text-right text-sm font-semibold ${
                          tx.type === 'income'
                            ? 'text-[#10B981]'
                            : tx.type === 'transfer'
                            ? 'text-[#0F766E] dark:text-[#6ac0b6]'
                            : 'text-[#131b2e] dark:text-white'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                        {formatMoney(tx.amount, tx.currency, state.settings.privacyMode)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openQuickAdd(tx)}
                          className="mr-1 rounded-lg p-1.5 text-[#404944] hover:bg-[#f2f3ff] hover:text-[#064E3B] dark:hover:bg-[#1c2640]"
                          aria-label={t('tx.editItem', { merchant: tx.merchant })}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTransactions([tx.id])}
                          className="rounded-lg p-1.5 text-[#404944] hover:bg-[#ffdad6]/50 hover:text-[#ba1a1a] dark:hover:bg-[#1c2640]"
                          aria-label={t('tx.deleteItem', { merchant: tx.merchant })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#F1F5F9] px-4 py-3 text-xs dark:border-[#232f4f]">
            <span className="font-numeric text-[#404944] dark:text-[#bfc9c3]">
              {t('tx.pageInfo', { page: safePage, total: totalPages, count: filtered.length })}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-[#CBD5E1] px-2.5 py-1 font-semibold text-[#131b2e] hover:bg-[#f2f3ff] disabled:opacity-40 dark:border-[#2f3b52] dark:text-[#eef0ff]"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {t('tx.prevPage')}
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-[#CBD5E1] px-2.5 py-1 font-semibold text-[#131b2e] hover:bg-[#f2f3ff] disabled:opacity-40 dark:border-[#2f3b52] dark:text-[#eef0ff]"
              >
                {t('tx.nextPage')}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
