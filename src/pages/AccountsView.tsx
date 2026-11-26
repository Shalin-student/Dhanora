import React, { useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  CheckCircle2,
  CreditCard,
  Edit3,
  Landmark,
  Plus,
  Scale,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import type { Account, AccountType, CurrencyCode } from '../types/finance';
import { computeClearedAccountBalance, computeNetWorth } from '../utils/calculations';
import { CURRENCY_META, formatMoney } from '../utils/currency';
import { computeNetWorthHistory } from '../utils/wealth';
import { NetWorthHistoryChart } from '../components/Charts';
import { InvestmentPortfolioSection } from '../components/InvestmentPortfolioSection';
import { useI18n } from '../i18n/useI18n';

const ACCOUNT_TYPES: AccountType[] = ['checking', 'savings', 'cash', 'credit', 'investment'];

export const AccountsView: React.FC = () => {
  const { state, selectedMonth, upsertAccount, deleteAccount, reconcileAccountBalance } =
    useFinance();
  const { baseCurrency, privacyMode } = state.settings;
  const { language, t, accName, memName, entityText, accountTypeLabel } = useI18n();
  const netWorth = computeNetWorth(state);
  const netWorthHistory = computeNetWorthHistory(state, selectedMonth, 6, language);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [institution, setInstitution] = useState('');
  const [initialBalance, setInitialBalance] = useState('0');
  const [creditLimit, setCreditLimit] = useState('5000');
  const [ownerId, setOwnerId] = useState(state.members[0]?.id ?? '');
  const [currency, setCurrency] = useState<CurrencyCode>(baseCurrency);

  // Archive visibility, Inline Edit, and Reconciliation state
  const [showArchived, setShowArchived] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    name: string;
    type: AccountType;
    institution: string;
    initialBalance: string;
    creditLimit: string;
    ownerId: string;
    currency: CurrencyCode;
  } | null>(null);
  const [reconcilingAccountId, setReconcilingAccountId] = useState<string | null>(null);
  const [stmtBalanceInput, setStmtBalanceInput] = useState('');

  const archivedCount = state.accounts.filter((a) => a.isArchived).length;
  const visibleAccounts = state.accounts.filter((a) => showArchived || !a.isArchived);

  const startEditAccount = (acc: Account) => {
    setReconcilingAccountId(null);
    setEditingAccountId(acc.id);
    setEditDraft({
      name: acc.name,
      type: acc.type,
      institution: acc.institution ?? '',
      initialBalance: String(acc.initialBalance),
      creditLimit: String(acc.creditLimit ?? 5000),
      ownerId: acc.ownerId,
      currency: acc.currency,
    });
  };

  const handleSaveAccountEdit = (acc: Account) => {
    if (!editDraft || !editDraft.name.trim()) return;
    upsertAccount({
      ...acc,
      name: editDraft.name.trim(),
      type: editDraft.type,
      institution: editDraft.institution.trim() || t('acc.manualFallback'),
      initialBalance: parseFloat(editDraft.initialBalance) || 0,
      creditLimit: editDraft.type === 'credit' ? parseFloat(editDraft.creditLimit) || 5000 : undefined,
      ownerId: editDraft.ownerId,
      currency: editDraft.currency,
    });
    setEditingAccountId(null);
    setEditDraft(null);
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    upsertAccount({
      id: `acc-${Date.now()}`,
      name: name.trim(),
      type,
      ownerId,
      initialBalance: parseFloat(initialBalance) || 0,
      creditLimit: type === 'credit' ? parseFloat(creditLimit) || 5000 : undefined,
      institution: institution.trim() || t('acc.manualFallback'),
      color: type === 'credit' ? '#f43f5e' : type === 'savings' ? '#10b981' : '#2563eb',
      currency,
    });
    setName('');
    setInstitution('');
    setInitialBalance('0');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {t('acc.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('acc.subtitle')}
          </p>
        </div>
        {archivedCount > 0 && (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            {t('acc.showArchived', { count: archivedCount })}
          </label>
        )}
      </div>

      {/* Net worth summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-semibold uppercase text-slate-500">{t('acc.totalAssets')}</div>
          <div className="mt-1 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {formatMoney(netWorth.assets, baseCurrency, privacyMode)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-semibold uppercase text-slate-500">
            {t('acc.totalLiabilities')}
          </div>
          <div className="mt-1 text-2xl font-extrabold text-rose-600 dark:text-rose-400">
            {formatMoney(netWorth.liabilities, baseCurrency, privacyMode)}
          </div>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 dark:border-blue-900 dark:bg-blue-950/30">
          <div className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">
            {t('acc.householdNetWorth')}
          </div>
          <div className="mt-1 text-2xl font-extrabold text-blue-900 dark:text-white">
            {formatMoney(netWorth.netWorth, baseCurrency, privacyMode)}
          </div>
        </div>
      </div>

      {/* 6-Month Net Worth History */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t('acc.historyTitle')}
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t('acc.historySub')}
          </span>
        </div>
        <NetWorthHistoryChart
          points={netWorthHistory}
          currency={baseCurrency}
          privacyMode={privacyMode}
        />
      </div>

      {/* Accounts grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visibleAccounts.map((acc) => {
          const bal = netWorth.accountBalances[acc.id] ?? acc.initialBalance;
          const clearedBal = computeClearedAccountBalance(acc, state.transactions);
          const pendingDelta = Number((bal - clearedBal).toFixed(2));
          const owner = state.members.find((m) => m.id === acc.ownerId);
          const utilization =
            acc.type === 'credit' && acc.creditLimit
              ? Math.min(100, Math.round((Math.abs(Math.min(0, bal)) / acc.creditLimit) * 100))
              : null;
          const isEditing = editingAccountId === acc.id && editDraft;
          const isReconciling = reconcilingAccountId === acc.id;
          const parsedStmt = parseFloat(stmtBalanceInput);
          const reconcileDiff = Number.isFinite(parsedStmt)
            ? Number((parsedStmt - clearedBal).toFixed(2))
            : null;

          return (
            <div
              key={acc.id}
              className={`rounded-2xl border p-5 shadow-xs ${
                acc.isArchived
                  ? 'border-slate-200/70 bg-slate-50/80 opacity-75 dark:border-slate-800 dark:bg-slate-900/50'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              {isEditing ? (
                <div className="space-y-2.5">
                  <input
                    type="text"
                    value={editDraft.name}
                    onChange={(e) =>
                      setEditDraft((d) => (d ? { ...d, name: e.target.value } : d))
                    }
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={editDraft.type}
                      onChange={(e) =>
                        setEditDraft((d) =>
                          d ? { ...d, type: e.target.value as AccountType } : d
                        )
                      }
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    >
                      {ACCOUNT_TYPES.map((k) => (
                        <option key={k} value={k}>
                          {accountTypeLabel(k)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={editDraft.institution}
                      onChange={(e) =>
                        setEditDraft((d) => (d ? { ...d, institution: e.target.value } : d))
                      }
                      placeholder={t('acc.instPlaceholder')}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={editDraft.initialBalance}
                      onChange={(e) =>
                        setEditDraft((d) => (d ? { ...d, initialBalance: e.target.value } : d))
                      }
                      placeholder={t('acc.openingPlaceholder')}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                    <select
                      value={editDraft.ownerId}
                      onChange={(e) =>
                        setEditDraft((d) => (d ? { ...d, ownerId: e.target.value } : d))
                      }
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    >
                      {state.members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.avatar} {memName(m)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={editDraft.currency}
                      onChange={(e) =>
                        setEditDraft((d) =>
                          d ? { ...d, currency: e.target.value as CurrencyCode } : d
                        )
                      }
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    >
                      {Object.keys(CURRENCY_META).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    {editDraft.type === 'credit' && (
                      <input
                        type="number"
                        value={editDraft.creditLimit}
                        onChange={(e) =>
                          setEditDraft((d) => (d ? { ...d, creditLimit: e.target.value } : d))
                        }
                        placeholder={t('acc.creditLimitPlaceholder')}
                        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                    )}
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAccountId(null);
                        setEditDraft(null);
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                    >
                      {t('layout.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveAccountEdit(acc)}
                      className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      {t('acc.saveChanges')}
                    </button>
                  </div>
                </div>
              ) : (
                <>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                    style={{ backgroundColor: acc.color }}
                  >
                    {acc.type === 'credit' ? (
                      <CreditCard className="h-5 w-5" />
                    ) : acc.type === 'cash' ? (
                      <Wallet className="h-5 w-5" />
                    ) : (
                      <Landmark className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {accName(acc)}
                      </h3>
                      {acc.isArchived && (
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          {t('acc.archivedBadge')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {accountTypeLabel(acc.type)} • {entityText(acc.institution)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => startEditAccount(acc)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
                    aria-label={t('acc.editAria', { name: acc.name })}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => upsertAccount({ ...acc, isArchived: !acc.isArchived })}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-amber-600 dark:hover:bg-slate-800"
                    aria-label={
                      acc.isArchived
                        ? t('acc.unarchiveAria', { name: acc.name })
                        : t('acc.archiveAria', { name: acc.name })
                    }
                  >
                    {acc.isArchived ? (
                      <ArchiveRestore className="h-3.5 w-3.5" />
                    ) : (
                      <Archive className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteAccount(acc.id)}
                    className="rounded p-1 text-slate-400 hover:text-rose-500"
                    aria-label={t('acc.deleteAria', { name: acc.name })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-baseline justify-between">
                <span
                  className={`text-xl font-extrabold ${
                    bal < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {formatMoney(bal, acc.currency, privacyMode)}
                </span>
                <span className="text-xs text-slate-500">
                  {owner?.avatar} {memName(owner)}
                </span>
              </div>

              {utilization !== null && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                    <span>{t('acc.creditUtil')}</span>
                    <span>
                      {t('acc.utilOf', {
                        pct: utilization,
                        limit: formatMoney(acc.creditLimit ?? 0, acc.currency, privacyMode),
                      })}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full ${
                        utilization > 30 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${utilization}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-3 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                {isReconciling ? (
                  <div className="space-y-2 rounded-xl bg-slate-50 p-2.5 text-xs dark:bg-slate-800/70">
                    <div className="flex items-center justify-between font-bold text-slate-700 dark:text-slate-200">
                      <span>{t('acc.reconcileTitle')}</span>
                      <button
                        type="button"
                        onClick={() => setReconcilingAccountId(null)}
                        className="text-[11px] font-semibold text-slate-500 hover:underline"
                      >
                        {t('layout.cancel')}
                      </button>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>{t('acc.clearedBal')}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatMoney(clearedBal, acc.currency, privacyMode)}
                      </span>
                    </div>
                    {pendingDelta !== 0 && (
                      <div className="flex justify-between text-[11px] text-amber-600 dark:text-amber-400">
                        <span>{t('acc.pendingBal')}</span>
                        <span className="font-semibold">
                          {pendingDelta > 0 ? '+' : ''}
                          {formatMoney(pendingDelta, acc.currency, privacyMode)}
                        </span>
                      </div>
                    )}
                    <input
                      type="number"
                      step="0.01"
                      value={stmtBalanceInput}
                      onChange={(e) => setStmtBalanceInput(e.target.value)}
                      placeholder={t('acc.stmtBalPlaceholder')}
                      aria-label={t('acc.stmtBalAria')}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                    />
                    {reconcileDiff !== null && (
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <span className="text-[11px] text-slate-600 dark:text-slate-300">
                          {t('acc.diffLabel')}{' '}
                          <strong
                            className={
                              Math.abs(reconcileDiff) < 0.01
                                ? 'text-emerald-600'
                                : 'text-amber-600'
                            }
                          >
                            {Math.abs(reconcileDiff) < 0.01
                              ? t('acc.matchedBadge')
                              : `${reconcileDiff > 0 ? '+' : ''}${formatMoney(
                                  reconcileDiff,
                                  acc.currency,
                                  privacyMode
                                )}`}
                          </strong>
                        </span>
                        {Math.abs(reconcileDiff) >= 0.01 && (
                          <button
                            type="button"
                            onClick={() => {
                              reconcileAccountBalance(acc.id, parsedStmt);
                              setReconcilingAccountId(null);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {t('acc.createAdjBtn')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setReconcilingAccountId(acc.id);
                      setStmtBalanceInput(String(clearedBal));
                    }}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <Scale className="h-3.5 w-3.5" />
                    {t('acc.reconcileBtn')}
                  </button>
                )}
              </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Account Form */}
      <form
        onSubmit={handleAddAccount}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">
          {t('acc.addFormTitle')}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('acc.namePlaceholder')}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AccountType)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            {ACCOUNT_TYPES.map((k) => (
              <option key={k} value={k}>
                {accountTypeLabel(k)}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder={t('acc.instPlaceholder')}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
          <input
            type="number"
            step="0.01"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            placeholder={t('acc.openingPlaceholder')}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            {state.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.avatar} {memName(m)}
              </option>
            ))}
          </select>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            {Object.keys(CURRENCY_META).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {type === 'credit' && (
            <input
              type="number"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              placeholder={t('acc.creditLimitPlaceholder')}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          )}
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> {t('acc.addAccountBtn')}
          </button>
        </div>
      </form>

      <InvestmentPortfolioSection />
    </div>
  );
};
