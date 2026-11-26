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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#131b2e]/55 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-add-title"
    >
      <div
        ref={modalRef}
        className="wdw-card-elevated max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 id="quick-add-title" className="text-lg font-bold text-[#131b2e] dark:text-white">
              {editingTransaction ? t('qa.editTitle') : t('qa.newTitle')}
            </h2>
            <p className="text-xs text-[#404944] dark:text-[#bfc9c3]">
              {t('qa.tipPrefix')}{' '}
              <kbd className="font-numeric rounded bg-[#f2f3ff] px-1.5 py-0.5 text-[11px] font-semibold dark:bg-[#1c2640]">
                N
              </kbd>{' '}
              {t('qa.tipSuffix')}
            </p>
          </div>
          <button
            type="button"
            onClick={closeQuickAdd}
            className="rounded-lg p-1.5 text-[#707974] hover:bg-[#f2f3ff] dark:hover:bg-[#1c2640]"
            aria-label={t('a11y.closeModal')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Type Tabs */}
        <div className="mb-5 grid grid-cols-3 gap-2 rounded-xl bg-[#f2f3ff] p-1 dark:bg-[#172036]">
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
                      ? 'bg-[#064E3B] text-white shadow-xs'
                      : txT === 'expense'
                      ? 'bg-[#904d00] text-white shadow-xs'
                      : 'bg-[#0F766E] text-white shadow-xs'
                    : 'text-[#404944] hover:text-[#131b2e] dark:text-[#bfc9c3] dark:hover:text-white'
                }`}
              >
                {txTypeLabel(txT)}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-[#ba1a1a]/30 bg-[#ffdad6] px-3 py-2 text-xs font-medium text-[#93000a]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-[#404944] dark:text-[#bfc9c3]">
                {t('qa.amount')}
              </label>
              <div className="relative">
                <span className="font-numeric pointer-events-none absolute top-2.5 left-3.5 text-base font-semibold text-[#64748B]">
                  {CURRENCY_META[currency]?.symbol ?? '₹'}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="font-numeric min-h-[44px] w-full rounded-lg border border-[#CBD5E1] bg-white py-2.5 pr-3.5 pl-9 text-lg font-bold text-[#131b2e] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-white"
                />
              </div>
              {formatIndianScaleHint(parseAmountShorthand(amount), language) && (
                <p className="font-numeric mt-1 text-[11px] font-semibold text-[#0F766E] dark:text-[#6ac0b6]">
                  ≈ {formatIndianScaleHint(parseAmountShorthand(amount), language)}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#404944] dark:text-[#bfc9c3]">
                {t('qa.currency')}
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="min-h-[44px] w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm font-medium text-[#131b2e] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-white"
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
              <label className="mb-1 block text-xs font-semibold text-[#404944] dark:text-[#bfc9c3]">
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
                className="min-h-[44px] w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#131b2e] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-white"
              />
              {matchedRulePattern && (
                <p className="mt-1 text-[11px] font-semibold text-[#0F766E] dark:text-[#6ac0b6]">
                  {t('qa.autoMatchedRule', { pattern: matchedRulePattern })}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#404944] dark:text-[#bfc9c3]">
                {t('qa.date')}
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="font-numeric min-h-[44px] w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#131b2e] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#404944] dark:text-[#bfc9c3]">
                {type === 'transfer' ? t('qa.fromAccount') : t('qa.account')}
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#131b2e] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-white"
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
                <label className="mb-1 block text-xs font-semibold text-[#404944] dark:text-[#bfc9c3]">
                  {t('qa.toAccount')}
                </label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="min-h-[44px] w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#131b2e] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-white"
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
                <label className="mb-1 block text-xs font-semibold text-[#404944] dark:text-[#bfc9c3]">
                  {t('qa.category')}
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setCategoryManuallyChosen(true);
                    setMatchedRulePattern(null);
                  }}
                  className="min-h-[44px] w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#131b2e] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-white"
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
              <label className="mb-1 block text-xs font-semibold text-[#404944] dark:text-[#bfc9c3]">
                {t('qa.member')}
              </label>
              <select
                value={memberId}
                disabled={roleCapabilities.isDependent}
                onChange={(e) => setMemberId(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#131b2e] disabled:opacity-75 dark:border-[#2f3b52] dark:bg-[#172036] dark:text-white"
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
                    ? 'border-[#0F766E] bg-[#9cf2e8]/30 text-[#003430] dark:bg-[#004d47]/50 dark:text-[#9cf2e8]'
                    : 'border-[#CBD5E1] text-[#404944] hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:text-[#bfc9c3] dark:hover:bg-[#1c2640]'
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
                    ? 'border-[#D97706] bg-[#FEF3C7] text-[#904d00] dark:bg-[#904d00]/40 dark:text-[#ffdcc3]'
                    : 'border-[#CBD5E1] text-[#404944] hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:text-[#bfc9c3] dark:hover:bg-[#1c2640]'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                {t('qa.splitMembers')}
              </button>
            </div>
          )}

          {enableCategorySplit && type === 'expense' && (
            <div className="rounded-xl border border-[#0F766E]/25 bg-[#9cf2e8]/20 p-3 dark:border-[#0F766E]/40 dark:bg-[#004d47]/25">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-[#003430] dark:text-[#9cf2e8]">
                  {t('qa.catSplitHeading')}
                </span>
                <button
                  type="button"
                  onClick={handleAddCategorySplitRow}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F766E] hover:underline dark:text-[#6ac0b6]"
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
                      className="flex-1 rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
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
                      className="font-numeric w-28 rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setCategorySplits((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="rounded p-1 text-[#707974] hover:text-[#ba1a1a]"
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
            <div className="rounded-xl border border-[#D97706]/30 bg-[#FEF3C7]/60 p-3 dark:border-[#904d00]/50 dark:bg-[#904d00]/20">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-[#904d00] dark:text-[#ffdcc3]">
                  {t('qa.memberShareHeading')}
                </span>
                <button
                  type="button"
                  onClick={handleEqualMemberSplit}
                  className="text-xs font-semibold text-[#904d00] hover:underline dark:text-[#fe932c]"
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
                      className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 dark:bg-[#172036]"
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
                        className="font-numeric w-24 rounded-md border border-[#CBD5E1] px-2 py-1 text-right text-xs dark:border-[#2f3b52] dark:bg-[#131b2e]"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#404944] dark:text-[#bfc9c3]">
                {t('qa.tags')}
              </label>
              <input
                type="text"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder={t('qa.tagsPlaceholder')}
                className="min-h-[44px] w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#131b2e] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#404944] dark:text-[#bfc9c3]">
                {t('qa.statusReceipt')}
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TransactionStatus)}
                  className="min-h-[44px] rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#131b2e] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-white"
                >
                  <option value="cleared">{txStatusLabel('cleared')}</option>
                  <option value="pending">{txStatusLabel('pending')}</option>
                </select>
                <label className="inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#CBD5E1] px-3 py-2 text-xs font-medium text-[#404944] hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:text-[#bfc9c3] dark:hover:bg-[#1c2640]">
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
            <label className="mb-1 block text-xs font-semibold text-[#404944] dark:text-[#bfc9c3]">
              {t('qa.notes')}
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('qa.notesPlaceholder')}
              className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#131b2e] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeQuickAdd}
              className="rounded-lg border border-[#CBD5E1] px-4 py-2 text-sm font-semibold text-[#404944] hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:text-[#bfc9c3] dark:hover:bg-[#1c2640]"
            >
              {t('layout.cancel')}
            </button>
            <button
              type="submit"
              className="wdw-btn-primary px-5 py-2 text-sm font-semibold shadow-sm"
            >
              {editingTransaction ? t('qa.saveChanges') : t('qa.saveTx')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
