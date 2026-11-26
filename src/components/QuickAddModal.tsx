import React, { useEffect, useState } from 'react';
import { Plus, Split, Trash2, Upload, Users, X } from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import { useModalA11y } from '../hooks/useModalA11y';
import type {
  CategorySplit,
  CurrencyCode,
  MemberSplit,
  TransactionStatus,
  TransactionType,
} from '../types/finance';
import { CURRENCY_META } from '../utils/currency';
import { matchMerchantRule } from '../utils/automation';
import { todayISO } from '../utils/calculations';
import { formatBytes, processReceiptFile } from '../utils/image';
import { formatIndianScaleHint, parseAmountShorthand } from '../utils/planners';
import { filterAccountsForActor } from '../utils/permissions';
import { useI18n } from '../i18n/useI18n';

export const QuickAddModal: React.FC = () => {
  const {
    state,
    activeProfile,
    roleCapabilities,
    isQuickAddOpen,
    closeQuickAdd,
    editingTransaction,
    addTransaction,
    updateTransaction,
  } = useFinance();
  const { language, t, catName, accName, memName, txTypeLabel, txStatusLabel } = useI18n();

  const availableAccounts = filterAccountsForActor(state.accounts, activeProfile);
  const availableMembers = roleCapabilities.isDependent ? [activeProfile] : state.members;

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(state.settings.baseCurrency);
  const [date, setDate] = useState(todayISO());
  const [merchant, setMerchant] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [status, setStatus] = useState<TransactionStatus>('cleared');
  const [tagsText, setTagsText] = useState('');
  const [note, setNote] = useState('');
  const [receiptName, setReceiptName] = useState<string | undefined>();
  const [receiptSizeBytes, setReceiptSizeBytes] = useState<number | undefined>();
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | undefined>();

  // Advanced split toggles
  const [enableCategorySplit, setEnableCategorySplit] = useState(false);
  const [categorySplits, setCategorySplits] = useState<CategorySplit[]>([]);
  const [enableMemberSplit, setEnableMemberSplit] = useState(false);
  const [memberSplits, setMemberSplits] = useState<MemberSplit[]>([]);
  const [matchedRulePattern, setMatchedRulePattern] = useState<string | null>(null);
  const [categoryManuallyChosen, setCategoryManuallyChosen] = useState(false);
  const [error, setError] = useState('');
  const modalRef = useModalA11y(isQuickAddOpen, closeQuickAdd);

  useEffect(() => {
    if (!isQuickAddOpen) return;
    setError('');
    setMatchedRulePattern(null);
    setCategoryManuallyChosen(Boolean(editingTransaction));
    if (editingTransaction) {
      setType(editingTransaction.type);
      setAmount(String(editingTransaction.amount));
      setCurrency(editingTransaction.currency);
      setDate(editingTransaction.date);
      setMerchant(editingTransaction.merchant);
      setCategoryId(editingTransaction.categoryId);
      setAccountId(editingTransaction.accountId);
      setToAccountId(editingTransaction.toAccountId ?? state.accounts[1]?.id ?? '');
      setMemberId(editingTransaction.memberId);
      setStatus(editingTransaction.status);
      setTagsText(editingTransaction.tags.join(', '));
      setNote(editingTransaction.note);
      setReceiptName(editingTransaction.receiptName);
      setReceiptSizeBytes(editingTransaction.receiptSizeBytes);
      setReceiptDataUrl(editingTransaction.receiptDataUrl);
      setEnableCategorySplit(Boolean(editingTransaction.categorySplits?.length));
      setCategorySplits(editingTransaction.categorySplits ?? []);
      setEnableMemberSplit(Boolean(editingTransaction.memberSplits?.length));
      setMemberSplits(editingTransaction.memberSplits ?? []);
    } else {
      const defaultExpenseCat =
        state.categories.find((c) => c.type === 'expense')?.id ?? '';
      setType('expense');
      setAmount('');
      setCurrency(state.settings.baseCurrency);
      setDate(todayISO());
      setMerchant('');
      setCategoryId(defaultExpenseCat);
      setAccountId(availableAccounts[0]?.id ?? state.accounts[0]?.id ?? '');
      setToAccountId(availableAccounts[1]?.id ?? availableAccounts[0]?.id ?? '');
      setMemberId(roleCapabilities.isDependent ? activeProfile.id : state.members[0]?.id ?? '');
      setStatus('cleared');
      setTagsText('');
      setNote('');
      setReceiptName(undefined);
      setReceiptSizeBytes(undefined);
      setReceiptDataUrl(undefined);
      setEnableCategorySplit(false);
      setCategorySplits([]);
      setEnableMemberSplit(false);
      setMemberSplits([]);
    }
  }, [isQuickAddOpen, editingTransaction, state.accounts, state.categories, state.members, state.settings.baseCurrency]);

  if (!isQuickAddOpen) return null;

  const filteredCategories = state.categories.filter((c) =>
    type === 'income' ? c.type === 'income' : c.type === 'expense'
  );

  const handleTypeChange = (nextType: TransactionType) => {
    setType(nextType);
    const matching = state.categories.filter((c) =>
      nextType === 'income' ? c.type === 'income' : c.type === 'expense'
    );
    if (matching.length > 0) {
      setCategoryId(matching[0].id);
    }
    if (nextType !== 'expense') {
      setEnableCategorySplit(false);
      setEnableMemberSplit(false);
    }
  };

  const handleEqualMemberSplit = () => {
    const num = parseFloat(amount) || 0;
    const activeMembers = state.members.filter((m) => m.role !== 'shared');
    if (activeMembers.length === 0 || num <= 0) return;
    const each = Number((num / activeMembers.length).toFixed(2));
    setEnableMemberSplit(true);
    setMemberSplits(
      activeMembers.map((m) => ({
        memberId: m.id,
        amount: each,
        settled: m.id === memberId,
      }))
    );
  };

  const handleAddCategorySplitRow = () => {
    const fallbackCat = filteredCategories[0]?.id ?? categoryId;
    setCategorySplits((prev) => [...prev, { categoryId: fallbackCat, amount: 0, note: '' }]);
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const processed = await processReceiptFile(file);
    setReceiptName(processed.fileName);
    setReceiptSizeBytes(processed.sizeBytes);
    setReceiptDataUrl(processed.dataUrl);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseAmountShorthand(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      setError(t('qa.errAmount'));
      return;
    }
    if (!merchant.trim()) {
      setError(t('qa.errMerchant'));
      return;
    }
    if (type === 'transfer' && accountId === toAccountId) {
      setError(t('qa.errTransferSame'));
      return;
    }

    if (enableCategorySplit && categorySplits.length > 0) {
      const splitTotal = categorySplits.reduce((s, sp) => s + sp.amount, 0);
      if (Math.abs(splitTotal - numericAmount) > 0.05) {
        setError(
          t('qa.errSplitTotal', {
            splitTotal: splitTotal.toFixed(2),
            total: numericAmount.toFixed(2),
          })
        );
        return;
      }
    }

    const payload = {
      type,
      amount: numericAmount,
      currency,
      date,
      merchant: merchant.trim(),
      categoryId:
        type === 'transfer'
          ? state.categories.find((c) => c.bucket === 'savings')?.id ?? categoryId
          : categoryId,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      memberId,
      categorySplits: enableCategorySplit && categorySplits.length > 0 ? categorySplits : undefined,
      memberSplits: enableMemberSplit && memberSplits.length > 0 ? memberSplits : undefined,
      tags: tagsText
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      note: note.trim(),
      status,
      receiptName,
      receiptSizeBytes,
      receiptDataUrl,
    };

    if (editingTransaction) {
      updateTransaction(editingTransaction.id, payload);
    } else {
      addTransaction(payload);
    }
    closeQuickAdd();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-add-title"
    >
      <div
        ref={modalRef}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 id="quick-add-title" className="text-lg font-bold text-slate-900 dark:text-white">
              {editingTransaction ? t('qa.editTitle') : t('qa.newTitle')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('qa.tipPrefix')}{' '}
              <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] dark:bg-slate-800">
                N
              </kbd>{' '}
              {t('qa.tipSuffix')}
            </p>
          </div>
          <button
            type="button"
            onClick={closeQuickAdd}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label={t('a11y.closeModal')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Type Tabs */}
        <div className="mb-5 grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(['expense', 'income', 'transfer'] as TransactionType[]).map((txT) => {
            const active = type === txT;
            return (
              <button
                key={txT}
                type="button"
                onClick={() => handleTypeChange(txT)}
                className={`rounded-lg py-2 text-sm font-semibold capitalize transition ${
                  active
                    ? txT === 'income'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : txT === 'expense'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {txTypeLabel(txT)}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                {t('qa.amount')}
              </label>
              <input
                type="text"
                inputMode="decimal"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-lg font-bold text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              {formatIndianScaleHint(parseAmountShorthand(amount), language) && (
                <p className="mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  ≈ {formatIndianScaleHint(parseAmountShorthand(amount), language)}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                {t('qa.currency')}
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium dark:border-slate-700 dark:bg-slate-800"
              >
                {Object.entries(CURRENCY_META).map(([code, meta]) => (
                  <option key={code} value={code}>
                    {code} ({meta.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                {type === 'income'
                  ? t('qa.sourceLabel')
                  : type === 'transfer'
                  ? t('qa.transferLabel')
                  : t('qa.merchantLabel')}
              </label>
              <input
                type="text"
                required
                value={merchant}
                onChange={(e) => {
                  const val = e.target.value;
                  setMerchant(val);
                  if (!editingTransaction && type !== 'transfer' && !categoryManuallyChosen) {
                    const rule = matchMerchantRule(val, state.rules ?? []);
                    if (rule) {
                      setCategoryId(rule.categoryId);
                      if (rule.memberId) setMemberId(rule.memberId);
                      if (rule.tags && rule.tags.length > 0 && !tagsText.trim()) {
                        setTagsText(rule.tags.join(', '));
                      }
                      setMatchedRulePattern(rule.pattern);
                    } else {
                      setMatchedRulePattern(null);
                    }
                  }
                }}
                placeholder={type === 'income' ? t('qa.incomePlaceholder') : t('qa.expensePlaceholder')}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
              {matchedRulePattern && (
                <p className="mt-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                  {t('qa.autoMatchedRule', { pattern: matchedRulePattern })}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                {t('qa.date')}
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                {type === 'transfer' ? t('qa.fromAccount') : t('qa.account')}
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {availableAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {accName(a)}
                  </option>
                ))}
              </select>
            </div>

            {type === 'transfer' ? (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t('qa.toAccount')}
                </label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  {availableAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {accName(a)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t('qa.category')}
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setCategoryManuallyChosen(true);
                    setMatchedRulePattern(null);
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  {filteredCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {catName(c)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                {t('qa.member')}
              </label>
              <select
                value={memberId}
                disabled={roleCapabilities.isDependent}
                onChange={(e) => setMemberId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-75 dark:border-slate-700 dark:bg-slate-800"
              >
                {availableMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.avatar} {memName(m)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {type === 'expense' && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = !enableCategorySplit;
                  setEnableCategorySplit(next);
                  if (next && categorySplits.length === 0) {
                    const total = parseFloat(amount) || 0;
                    setCategorySplits([
                      { categoryId, amount: Number((total / 2).toFixed(2)), note: '' },
                      {
                        categoryId: filteredCategories[1]?.id ?? categoryId,
                        amount: Number((total / 2).toFixed(2)),
                        note: '',
                      },
                    ]);
                  }
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  enableCategorySplit
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Split className="h-3.5 w-3.5" />
                {t('qa.splitCats')}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!enableMemberSplit) handleEqualMemberSplit();
                  else setEnableMemberSplit(false);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  enableMemberSplit
                    ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                {t('qa.splitMembers')}
              </button>
            </div>
          )}

          {enableCategorySplit && type === 'expense' && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                  {t('qa.catSplitHeading')}
                </span>
                <button
                  type="button"
                  onClick={handleAddCategorySplitRow}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> {t('qa.addRow')}
                </button>
              </div>
              <div className="space-y-2">
                {categorySplits.map((sp, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={sp.categoryId}
                      onChange={(e) =>
                        setCategorySplits((prev) =>
                          prev.map((item, idx) =>
                            idx === i ? { ...item, categoryId: e.target.value } : item
                          )
                        )
                      }
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    >
                      {filteredCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icon} {catName(c)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={sp.amount}
                      onChange={(e) =>
                        setCategorySplits((prev) =>
                          prev.map((item, idx) =>
                            idx === i ? { ...item, amount: parseFloat(e.target.value) || 0 } : item
                          )
                        )
                      }
                      className="w-28 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setCategorySplits((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="rounded p-1 text-slate-400 hover:text-rose-500"
                      aria-label={t('qa.removeSplitRow')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {enableMemberSplit && type === 'expense' && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900/50 dark:bg-violet-950/20">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-violet-900 dark:text-violet-200">
                  {t('qa.memberShareHeading')}
                </span>
                <button
                  type="button"
                  onClick={handleEqualMemberSplit}
                  className="text-xs font-semibold text-violet-600 hover:underline"
                >
                  {t('qa.splitEqually')}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {memberSplits.map((sp, idx) => {
                  const mem = state.members.find((m) => m.id === sp.memberId);
                  return (
                    <div
                      key={sp.memberId}
                      className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 dark:bg-slate-800"
                    >
                      <span className="text-xs font-medium">
                        {mem?.avatar} {memName(mem)}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={sp.amount}
                        onChange={(e) =>
                          setMemberSplits((prev) =>
                            prev.map((row, rIdx) =>
                              rIdx === idx ? { ...row, amount: parseFloat(e.target.value) || 0 } : row
                            )
                          )
                        }
                        className="w-24 rounded border border-slate-200 px-2 py-1 text-right text-xs dark:border-slate-700 dark:bg-slate-900"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                {t('qa.tags')}
              </label>
              <input
                type="text"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder={t('qa.tagsPlaceholder')}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                {t('qa.statusReceipt')}
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TransactionStatus)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="cleared">{txStatusLabel('cleared')}</option>
                  <option value="pending">{txStatusLabel('pending')}</option>
                </select>
                <label className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                  <Upload className="h-3.5 w-3.5" />
                  <span className="truncate">
                    {receiptName
                      ? `${receiptName}${receiptSizeBytes ? ` (${formatBytes(receiptSizeBytes)})` : ''}`
                      : t('qa.attachReceipt')}
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => void handleReceiptUpload(e)}
                  />
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              {t('qa.notes')}
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('qa.notesPlaceholder')}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeQuickAdd}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t('layout.cancel')}
            </button>
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              {editingTransaction ? t('qa.saveChanges') : t('qa.saveTx')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
