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
          <h1 className="text-2xl font-bold tracking-tight text-[#131b2e] dark:text-white">
            {t('bills.title')}
          </h1>
          <p className="text-sm text-[#404944] dark:text-[#707974]">
            {t('bills.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => runAutoPostNow()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#0F766E]/25 bg-[#f2f3ff] px-3.5 py-2 text-xs font-semibold text-[#064E3B] hover:bg-[#9cf2e8]/45 dark:border-[#0F766E]/50 dark:bg-[#004d47]/40 dark:text-[#9cf2e8]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t('bills.runAutoPosts')}
          </button>
          <div className="rounded-2xl border border-[#bfc9c3]/60 bg-white px-4 py-2 dark:border-[#232f4f] dark:bg-[#131b2e]">
            <div className="text-[11px] font-semibold text-[#404944]">{t('bills.estIncome')}</div>
            <div className="font-numeric text-sm font-bold text-[#10B981] dark:text-emerald-400">
              +{formatMoney(monthlyRecurringIncome, baseCurrency, privacyMode)}
            </div>
          </div>
          <div className="rounded-2xl border border-[#bfc9c3]/60 bg-white px-4 py-2 dark:border-[#232f4f] dark:bg-[#131b2e]">
            <div className="text-[11px] font-semibold text-[#404944]">{t('bills.estBills')}</div>
            <div className="font-numeric text-sm font-bold text-[#ba1a1a] dark:text-rose-400">
              -{formatMoney(monthlyRecurringBills, baseCurrency, privacyMode)}
            </div>
          </div>
        </div>
      </div>

      {/* Add Recurring Rule */}
      <form
        onSubmit={handleAddRule}
        className="wdw-card p-5"
      >
        <h2 className="mb-4 text-base font-bold text-[#131b2e] dark:text-white">
          {t('bills.formTitle')}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('bills.titlePlaceholder')}
            className="rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TransactionType)}
            className="rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
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
            className="rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
          />
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
            className="rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
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
            className="rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
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
            className="rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
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
            className="rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
          >
            {state.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.avatar} {memName(m)}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-[#404944] dark:text-[#bfc9c3]">
            <input
              type="checkbox"
              checked={autoPost}
              onChange={(e) => setAutoPost(e.target.checked)}
            />
            {t('bills.markAutoPost')}
          </label>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#064E3B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#043D2E]"
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
                  ? 'border-[#bfc9c3]/60 bg-white dark:border-[#232f4f] dark:bg-[#131b2e]'
                  : 'border-[#bfc9c3]/60/70 bg-[#f2f3ff] opacity-70 dark:border-[#232f4f] dark:bg-[#131b2e]/90'
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
                      className="rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
                    />
                    <div className="flex gap-2">
                      <select
                        value={editDraft.type}
                        onChange={(e) =>
                          setEditDraft((d) =>
                            d ? { ...d, type: e.target.value as TransactionType } : d
                          )
                        }
                        className="rounded-lg border border-[#CBD5E1] bg-white px-2 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
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
                        className="w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
                      />
                    </div>
                    <select
                      value={editDraft.frequency}
                      onChange={(e) =>
                        setEditDraft((d) =>
                          d ? { ...d, frequency: e.target.value as RecurrenceFrequency } : d
                        )
                      }
                      className="rounded-lg border border-[#CBD5E1] bg-white px-2 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
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
                      className="rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
                    />
                    <select
                      value={editDraft.categoryId}
                      onChange={(e) =>
                        setEditDraft((d) => (d ? { ...d, categoryId: e.target.value } : d))
                      }
                      className="rounded-lg border border-[#CBD5E1] bg-white px-2 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
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
                      className="rounded-lg border border-[#CBD5E1] bg-white px-2 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
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
                      className="rounded-lg border border-[#CBD5E1] bg-white px-2 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
                    >
                      {state.members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.avatar} {memName(m)}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-xs text-[#404944] dark:text-[#bfc9c3]">
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
                      className="rounded-lg border border-[#bfc9c3]/60 px-3 py-1 text-xs font-semibold text-[#404944] hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:text-[#bfc9c3]"
                    >
                      {t('layout.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveRuleEdit(rule)}
                      className="rounded-lg bg-[#064E3B] px-3 py-1 text-xs font-semibold text-white hover:bg-[#043D2E]"
                    >
                      {t('common.save')}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaedff] text-lg dark:bg-[#172036]">
                        {cat?.icon ?? <CalendarClock className="h-5 w-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-sm font-bold text-[#131b2e] dark:text-white">
                          <span>{entityText(rule.title)}</span>
                          {isOverdue && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-[#904d00] dark:bg-amber-950 dark:text-amber-300">
                              {t('bills.dueBadge')}
                            </span>
                          )}
                          {rule.autoPost && (
                            <span className="rounded-full bg-[#9cf2e8]/45 px-2 py-0.5 text-[10px] font-bold text-[#064E3B] dark:bg-[#004d47]/50 dark:text-[#9cf2e8]">
                              {t('bills.autopayBadge')}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#404944] dark:text-[#707974]">
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
                      className={`font-numeric text-base font-bold ${
                        rule.type === 'income'
                          ? 'text-[#10B981] dark:text-emerald-400'
                          : 'text-[#131b2e] dark:text-white'
                      }`}
                    >
                      {rule.type === 'income' ? '+' : '-'}
                      {formatMoney(rule.amount, rule.currency, privacyMode)}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#F1F5F9] pt-3 dark:border-[#232f4f]">
                    <span className="text-[11px] text-[#404944]">
                      {rule.lastPostedDate
                        ? t('bills.lastPosted', { date: rule.lastPostedDate })
                        : t('bills.notYetPosted')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => startEditRule(rule)}
                        className="rounded-lg p-1.5 text-[#707974] hover:bg-[#eaedff] hover:text-[#0F766E] dark:hover:bg-[#1c2640]"
                        aria-label={t('bills.editAria', { title: rule.title })}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => upsertRecurring({ ...rule, isActive: !rule.isActive })}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#bfc9c3]/60 px-2.5 py-1 text-xs font-semibold text-[#404944] hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:text-[#bfc9c3] dark:hover:bg-[#1c2640]"
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
                        className="inline-flex items-center gap-1 rounded-lg bg-[#064E3B] px-3 py-1 text-xs font-semibold text-white hover:bg-[#043D2E]"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t('bills.postNow')}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRecurring(rule.id)}
                        className="rounded-lg p-1.5 text-[#707974] hover:text-[#ba1a1a]"
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
