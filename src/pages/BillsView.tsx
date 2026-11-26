import React, { useState } from 'react';
import { CalendarClock, CheckCircle2, Edit3, Pause, Play, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import type { RecurrenceFrequency, RecurringRule, TransactionType } from '../types/finance';
import { formatMoney } from '../utils/currency';
import { todayISO } from '../utils/calculations';
import { useI18n } from '../i18n/useI18n';

export const BillsView: React.FC = () => {
  const { state, upsertRecurring, deleteRecurring, postRecurringDue, runAutoPostNow } =
    useFinance();
  const { baseCurrency, privacyMode } = state.settings;
  const { t, catName, accName, memName, entityText, freqLabel } = useI18n();
  const today = todayISO();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [nextDueDate, setNextDueDate] = useState(today);
  const [categoryId, setCategoryId] = useState(state.categories[4]?.id ?? state.categories[0]?.id ?? '');
  const [accountId, setAccountId] = useState(state.accounts[0]?.id ?? '');
  const [memberId, setMemberId] = useState(state.members[0]?.id ?? '');
  const [autoPost, setAutoPost] = useState(false);

  // Inline schedule editing state
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    title: string;
    type: TransactionType;
    amount: string;
    frequency: RecurrenceFrequency;
    nextDueDate: string;
    categoryId: string;
    accountId: string;
    memberId: string;
    autoPost: boolean;
  } | null>(null);

  const startEditRule = (rule: RecurringRule) => {
    setEditingRuleId(rule.id);
    setEditDraft({
      title: rule.title,
      type: rule.type,
      amount: String(rule.amount),
      frequency: rule.frequency,
      nextDueDate: rule.nextDueDate,
      categoryId: rule.categoryId,
      accountId: rule.accountId,
      memberId: rule.memberId,
      autoPost: rule.autoPost,
    });
  };

  const handleSaveRuleEdit = (rule: RecurringRule) => {
    if (!editDraft) return;
    const val = parseFloat(editDraft.amount);
    if (!editDraft.title.trim() || Number.isNaN(val) || val <= 0) return;
    upsertRecurring({
      ...rule,
      title: editDraft.title.trim(),
      type: editDraft.type,
      amount: val,
      frequency: editDraft.frequency,
      nextDueDate: editDraft.nextDueDate,
      categoryId: editDraft.categoryId,
      accountId: editDraft.accountId,
      memberId: editDraft.memberId,
      autoPost: editDraft.autoPost,
    });
    setEditingRuleId(null);
    setEditDraft(null);
  };

  const sortedRules = [...state.recurring].sort((a, b) =>
    a.nextDueDate.localeCompare(b.nextDueDate)
  );

  const monthlyEquivalent = (amt: number, freq: RecurrenceFrequency) => {
    switch (freq) {
      case 'weekly':
        return amt * 4.33;
      case 'biweekly':
        return amt * 2.16;
      case 'monthly':
        return amt;
      case 'quarterly':
        return amt / 3;
      case 'yearly':
        return amt / 12;
    }
  };

  const monthlyRecurringIncome = sortedRules
    .filter((r) => r.isActive && r.type === 'income')
    .reduce((sum, r) => sum + monthlyEquivalent(r.amount, r.frequency), 0);

  const monthlyRecurringBills = sortedRules
    .filter((r) => r.isActive && r.type === 'expense')
    .reduce((sum, r) => sum + monthlyEquivalent(r.amount, r.frequency), 0);

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!title.trim() || Number.isNaN(val) || val <= 0) return;
    upsertRecurring({
      id: `rec-${Date.now()}`,
      title: title.trim(),
      type,
      amount: val,
      currency: baseCurrency,
      frequency,
      nextDueDate,
      categoryId,
      accountId,
      memberId,
      autoPost,
      isActive: true,
    });
    setTitle('');
    setAmount('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {t('bills.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('bills.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => runAutoPostNow()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t('bills.runAutoPosts')}
          </button>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-[11px] font-semibold text-slate-500">{t('bills.estIncome')}</div>
            <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
              +{formatMoney(monthlyRecurringIncome, baseCurrency, privacyMode)}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-[11px] font-semibold text-slate-500">{t('bills.estBills')}</div>
            <div className="text-sm font-extrabold text-rose-600 dark:text-rose-400">
              -{formatMoney(monthlyRecurringBills, baseCurrency, privacyMode)}
            </div>
          </div>
        </div>
      </div>

      {/* Add Recurring Rule */}
      <form
        onSubmit={handleAddRule}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">
          {t('bills.formTitle')}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('bills.titlePlaceholder')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TransactionType)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="expense">{t('bills.optExpense')}</option>
            <option value="income">{t('bills.optIncome')}</option>
          </select>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t('bills.amountPlaceholder')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            {(['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'] as const).map((f) => (
              <option key={f} value={f}>
                {freqLabel(f)}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={nextDueDate}
            onChange={(e) => setNextDueDate(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            {state.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {catName(c)}
              </option>
            ))}
          </select>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {accName(a)}
              </option>
            ))}
          </select>
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            {state.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.avatar} {memName(m)}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={autoPost}
              onChange={(e) => setAutoPost(e.target.checked)}
            />
            {t('bills.markAutoPost')}
          </label>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            {t('bills.addSchedule')}
          </button>
        </div>
      </form>

      {/* Schedule List */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {sortedRules.map((rule) => {
          const cat = state.categories.find((c) => c.id === rule.categoryId);
          const acc = state.accounts.find((a) => a.id === rule.accountId);
          const mem = state.members.find((m) => m.id === rule.memberId);
          const isOverdue = rule.isActive && rule.nextDueDate < today;
          const isEditing = editingRuleId === rule.id && editDraft;

          return (
            <div
              key={rule.id}
              className={`rounded-2xl border p-4 shadow-xs transition ${
                rule.isActive
                  ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                  : 'border-slate-200/70 bg-slate-50 opacity-70 dark:border-slate-800 dark:bg-slate-900/40'
              }`}
            >
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      value={editDraft.title}
                      onChange={(e) =>
                        setEditDraft((d) => (d ? { ...d, title: e.target.value } : d))
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                    <div className="flex gap-2">
                      <select
                        value={editDraft.type}
                        onChange={(e) =>
                          setEditDraft((d) =>
                            d ? { ...d, type: e.target.value as TransactionType } : d
                          )
                        }
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                      >
                        <option value="expense">{t('bills.optExpense')}</option>
                        <option value="income">{t('bills.optIncome')}</option>
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editDraft.amount}
                        onChange={(e) =>
                          setEditDraft((d) => (d ? { ...d, amount: e.target.value } : d))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <select
                      value={editDraft.frequency}
                      onChange={(e) =>
                        setEditDraft((d) =>
                          d ? { ...d, frequency: e.target.value as RecurrenceFrequency } : d
                        )
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    >
                      {(['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'] as const).map((f) => (
                        <option key={f} value={f}>
                          {freqLabel(f)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={editDraft.nextDueDate}
                      onChange={(e) =>
                        setEditDraft((d) => (d ? { ...d, nextDueDate: e.target.value } : d))
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                    <select
                      value={editDraft.categoryId}
                      onChange={(e) =>
                        setEditDraft((d) => (d ? { ...d, categoryId: e.target.value } : d))
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    >
                      {state.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icon} {catName(c)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={editDraft.accountId}
                      onChange={(e) =>
                        setEditDraft((d) => (d ? { ...d, accountId: e.target.value } : d))
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    >
                      {state.accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {accName(a)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={editDraft.memberId}
                      onChange={(e) =>
                        setEditDraft((d) => (d ? { ...d, memberId: e.target.value } : d))
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    >
                      {state.members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.avatar} {memName(m)}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={editDraft.autoPost}
                        onChange={(e) =>
                          setEditDraft((d) => (d ? { ...d, autoPost: e.target.checked } : d))
                        }
                      />
                      {t('bills.markAutoPost')}
                    </label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRuleId(null);
                        setEditDraft(null);
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                    >
                      {t('layout.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveRuleEdit(rule)}
                      className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      {t('common.save')}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg dark:bg-slate-800">
                        {cat?.icon ?? <CalendarClock className="h-5 w-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                          <span>{entityText(rule.title)}</span>
                          {isOverdue && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              {t('bills.dueBadge')}
                            </span>
                          )}
                          {rule.autoPost && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                              {t('bills.autopayBadge')}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {t('bills.nextLine', {
                            date: rule.nextDueDate,
                            freq: freqLabel(rule.frequency),
                            acc: accName(acc),
                            mem: `${mem?.avatar ?? ''} ${memName(mem)}`.trim(),
                          })}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`text-base font-extrabold ${
                        rule.type === 'income'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {rule.type === 'income' ? '+' : '-'}
                      {formatMoney(rule.amount, rule.currency, privacyMode)}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500">
                      {rule.lastPostedDate
                        ? t('bills.lastPosted', { date: rule.lastPostedDate })
                        : t('bills.notYetPosted')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => startEditRule(rule)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
                        aria-label={t('bills.editAria', { title: rule.title })}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => upsertRecurring({ ...rule, isActive: !rule.isActive })}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {rule.isActive ? (
                          <>
                            <Pause className="h-3 w-3" /> {t('bills.pause')}
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3" /> {t('bills.resume')}
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => postRecurringDue(rule.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t('bills.postNow')}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRecurring(rule.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600"
                        aria-label={t('bills.deleteAria', { title: rule.title })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
