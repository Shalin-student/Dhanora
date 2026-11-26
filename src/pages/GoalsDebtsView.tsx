import React, { useState } from 'react';
import { CreditCard, Edit3, Plus, Target, Trash2, TrendingUp } from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import type { DebtItem, GoalCategory, SavingsGoal } from '../types/finance';
import { debtPayoffMonths, goalMonthlyContributionNeeded, todayISO } from '../utils/calculations';
import { formatMoney } from '../utils/currency';
import { compareDebtStrategies } from '../utils/wealth';
import { filterAccountsForActor, filterGoalsForActor } from '../utils/permissions';
import { canCreateGoal } from '../utils/entitlements';
import { useI18n } from '../i18n/useI18n';

export const GoalsDebtsView: React.FC = () => {
  const {
    state,
    activeProfile,
    roleCapabilities,
    setActiveView,
    pushToast,
    upsertGoal,
    contributeGoal,
    deleteGoal,
    upsertDebt,
    recordDebtPayment,
    deleteDebt,
  } = useFinance();
  const { baseCurrency, privacyMode } = state.settings;
  const { t, entityText, accName, goalCatLabel } = useI18n();
  const visibleGoals = filterGoalsForActor(state.goals, activeProfile);
  const availableAccounts = filterAccountsForActor(state.accounts, activeProfile);
  const goalLimit = canCreateGoal(state);

  // Goal creation
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalDate, setGoalDate] = useState(todayISO());
  const [goalCategory, setGoalCategory] = useState<GoalCategory>('emergency');
  const [goalIcon, setGoalIcon] = useState('🎯');

  // Contribute state
  const [contribGoalId, setContribGoalId] = useState<string | null>(null);
  const [contribAmount, setContribAmount] = useState('250');
  const [contribAccount, setContribAccount] = useState(state.accounts[0]?.id ?? '');

  // Debt creation
  const [debtName, setDebtName] = useState('');
  const [debtLender, setDebtLender] = useState('');
  const [debtBalance, setDebtBalance] = useState('');
  const [debtApr, setDebtApr] = useState('5.5');
  const [debtMinPay, setDebtMinPay] = useState('300');

  // Debt payment
  const [payDebtId, setPayDebtId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('300');
  const [extraDebtPayment, setExtraDebtPayment] = useState(250);

  // Inline Edit states for Goals & Debts
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalDraft, setGoalDraft] = useState<{
    name: string;
    targetAmount: string;
    targetDate: string;
    category: GoalCategory;
    icon: string;
  } | null>(null);

  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [debtDraft, setDebtDraft] = useState<{
    name: string;
    lender: string;
    currentBalance: string;
    interestRateApr: string;
    minimumPayment: string;
  } | null>(null);

  const startEditGoal = (goal: SavingsGoal) => {
    setEditingGoalId(goal.id);
    setGoalDraft({
      name: goal.name,
      targetAmount: String(goal.targetAmount),
      targetDate: goal.targetDate,
      category: goal.category,
      icon: goal.icon,
    });
  };

  const handleSaveGoalEdit = (goal: SavingsGoal) => {
    if (!goalDraft) return;
    const target = parseFloat(goalDraft.targetAmount);
    if (!goalDraft.name.trim() || Number.isNaN(target) || target <= 0) return;
    upsertGoal({
      ...goal,
      name: goalDraft.name.trim(),
      targetAmount: target,
      targetDate: goalDraft.targetDate,
      category: goalDraft.category,
      icon: goalDraft.icon || '🎯',
    });
    setEditingGoalId(null);
    setGoalDraft(null);
  };

  const startEditDebt = (debt: DebtItem) => {
    setEditingDebtId(debt.id);
    setDebtDraft({
      name: debt.name,
      lender: debt.lender,
      currentBalance: String(debt.currentBalance),
      interestRateApr: String(debt.interestRateApr),
      minimumPayment: String(debt.minimumPayment),
    });
  };

  const handleSaveDebtEdit = (debt: DebtItem) => {
    if (!debtDraft) return;
    const bal = parseFloat(debtDraft.currentBalance);
    if (!debtDraft.name.trim() || Number.isNaN(bal) || bal < 0) return;
    upsertDebt({
      ...debt,
      name: debtDraft.name.trim(),
      lender: debtDraft.lender.trim() || debt.lender,
      originalAmount: Math.max(debt.originalAmount, bal),
      currentBalance: bal,
      interestRateApr: parseFloat(debtDraft.interestRateApr) || 0,
      minimumPayment: parseFloat(debtDraft.minimumPayment) || 0,
    });
    setEditingDebtId(null);
    setDebtDraft(null);
  };

  const debtComparison = compareDebtStrategies(state.debts, extraDebtPayment);

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalLimit.allowed) {
      pushToast(t('ent.goalLimitReached', { max: goalLimit.limit ?? 3 }));
      return;
    }
    const target = parseFloat(goalTarget);
    if (!goalName.trim() || Number.isNaN(target) || target <= 0) return;
    upsertGoal({
      id: `goal-${Date.now()}`,
      name: goalName.trim(),
      targetAmount: target,
      currentAmount: 0,
      targetDate: goalDate,
      category: goalCategory,
      linkedAccountId:
        availableAccounts.find((a) => a.type === 'savings')?.id ?? availableAccounts[0]?.id,
      ownerId: roleCapabilities.isDependent
        ? activeProfile.id
        : state.members[0]?.id ?? 'm-shared',
      priority: 'high',
      color: '#10b981',
      icon: goalIcon || '🎯',
    });
    setGoalName('');
    setGoalTarget('');
  };

  const handleAddDebt = (e: React.FormEvent) => {
    e.preventDefault();
    const bal = parseFloat(debtBalance);
    if (!debtName.trim() || Number.isNaN(bal) || bal <= 0) return;
    upsertDebt({
      id: `debt-${Date.now()}`,
      name: debtName.trim(),
      lender: debtLender.trim() || 'Bank',
      originalAmount: bal,
      currentBalance: bal,
      interestRateApr: parseFloat(debtApr) || 0,
      minimumPayment: parseFloat(debtMinPay) || 100,
      dueDay: 15,
      ownerId: state.members[0]?.id ?? 'm-shared',
      accountId: state.accounts[0]?.id,
    });
    setDebtName('');
    setDebtLender('');
    setDebtBalance('');
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {roleCapabilities.isDependent ? t('goals.depTitle') : t('goals.adminTitle')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {roleCapabilities.isDependent ? t('goals.depSubtitle') : t('goals.adminSubtitle')}
        </p>
      </div>

      {/* Savings Goals Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-emerald-500" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('goals.sectionHeading')}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleGoals.map((goal) => {
            const pct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
            const neededMonthly = goalMonthlyContributionNeeded(goal);
            const isContributing = contribGoalId === goal.id;
            const isEditing = editingGoalId === goal.id && goalDraft;

            return (
              <div
                key={goal.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
              >
                {isEditing ? (
                  <div className="space-y-2.5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={goalDraft.name}
                        onChange={(e) =>
                          setGoalDraft((d) => (d ? { ...d, name: e.target.value } : d))
                        }
                        className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                      <input
                        type="text"
                        value={goalDraft.icon}
                        onChange={(e) =>
                          setGoalDraft((d) => (d ? { ...d, icon: e.target.value } : d))
                        }
                        className="w-11 rounded-lg border border-slate-300 text-center text-sm dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="1"
                        value={goalDraft.targetAmount}
                        onChange={(e) =>
                          setGoalDraft((d) => (d ? { ...d, targetAmount: e.target.value } : d))
                        }
                        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                      <input
                        type="date"
                        value={goalDraft.targetDate}
                        onChange={(e) =>
                          setGoalDraft((d) => (d ? { ...d, targetDate: e.target.value } : d))
                        }
                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <select
                      value={goalDraft.category}
                      onChange={(e) =>
                        setGoalDraft((d) =>
                          d ? { ...d, category: e.target.value as GoalCategory } : d
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    >
                      {(['emergency', 'travel', 'education', 'home', 'vehicle', 'other'] as const).map(
                        (gc) => (
                          <option key={gc} value={gc}>
                            {goalCatLabel(gc)}
                          </option>
                        )
                      )}
                    </select>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGoalId(null);
                          setGoalDraft(null);
                        }}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                      >
                        {t('layout.cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveGoalEdit(goal)}
                        className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        {t('common.save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-xl dark:bg-emerald-950/50">
                        {goal.icon}
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {entityText(goal.name)}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t('goals.targetLine', {
                            date: goal.targetDate,
                            cat: goalCatLabel(goal.category),
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => startEditGoal(goal)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
                        aria-label={t('goals.editGoalAria', { name: goal.name })}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteGoal(goal.id)}
                        className="rounded p-1 text-slate-400 hover:text-rose-500"
                        aria-label={t('goals.deleteGoalAria', { name: goal.name })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs font-semibold">
                      <span>{formatMoney(goal.currentAmount, baseCurrency, privacyMode)}</span>
                      <span className="text-slate-500">
                        {t('goals.ofTarget', {
                          amt: formatMoney(goal.targetAmount, baseCurrency, privacyMode),
                          pct,
                        })}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                    <span>
                      {t('goals.paceNeeded')}{' '}
                      <strong>
                        {t('goals.perMo', {
                          amt: formatMoney(neededMonthly, baseCurrency, privacyMode),
                        })}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                  {isContributing ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="1"
                          value={contribAmount}
                          onChange={(e) => setContribAmount(e.target.value)}
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                        />
                        <select
                          value={contribAccount}
                          onChange={(e) => setContribAccount(e.target.value)}
                          className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                        >
                          {state.accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {accName(a)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setContribGoalId(null)}
                          className="text-xs text-slate-500"
                        >
                          {t('layout.cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            contributeGoal(
                              goal.id,
                              parseFloat(contribAmount) || 0,
                              contribAccount,
                              goal.ownerId
                            );
                            setContribGoalId(null);
                          }}
                          className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                        >
                          {t('goals.confirm')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setContribGoalId(goal.id)}
                      className="w-full rounded-xl bg-emerald-50 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950"
                    >
                      {t('goals.contributeBtn')}
                    </button>
                  )}
                </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* New Goal Form */}
        {!goalLimit.allowed && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <span>{t('ent.goalLimitReached', { max: goalLimit.limit ?? 3 })}</span>
            <button
              type="button"
              onClick={() => setActiveView('pricing')}
              className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700"
            >
              {t('ent.upgradeBtn')}
            </button>
          </div>
        )}
        <form
          onSubmit={handleAddGoal}
          className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-6"
        >
          <input
            type="text"
            required
            value={goalName}
            onChange={(e) => setGoalName(e.target.value)}
            placeholder={t('goals.newNamePlaceholder')}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs sm:col-span-2 dark:border-slate-700 dark:bg-slate-800"
          />
          <input
            type="number"
            min="1"
            required
            value={goalTarget}
            onChange={(e) => setGoalTarget(e.target.value)}
            placeholder={t('goals.targetAmtPlaceholder')}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
          <input
            type="date"
            value={goalDate}
            onChange={(e) => setGoalDate(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
          <div className="flex gap-2">
            <select
              value={goalCategory}
              onChange={(e) => setGoalCategory(e.target.value as GoalCategory)}
              className="w-full rounded-xl border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              {(['emergency', 'travel', 'education', 'home', 'vehicle', 'other'] as const).map(
                (gc) => (
                  <option key={gc} value={gc}>
                    {goalCatLabel(gc)}
                  </option>
                )
              )}
            </select>
            <input
              type="text"
              value={goalIcon}
              onChange={(e) => setGoalIcon(e.target.value)}
              className="w-12 rounded-xl border border-slate-300 text-center text-sm dark:border-slate-700 dark:bg-slate-800"
              aria-label={t('goals.iconAria')}
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> {t('goals.addGoalBtn')}
          </button>
        </form>
      </section>

      {/* Debt Payoff Section (hidden for dependent profiles) */}
      {!roleCapabilities.isDependent && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-rose-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {t('goals.debtSection')}
            </h2>
          </div>

          {/* Snowball vs Avalanche Simulator */}
          {state.debts.some((d) => d.currentBalance > 0) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {t('goals.simTitle')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('goals.simDesc')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="extra-debt-slider"
                    className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                  >
                    {t('goals.extraSliderLabel')}
                  </label>
                  <input
                    id="extra-debt-slider"
                    type="range"
                    min={0}
                    max={1500}
                    step={25}
                    value={extraDebtPayment}
                    onChange={(e) => setExtraDebtPayment(Number(e.target.value))}
                    className="w-32 accent-blue-600"
                  />
                  <span className="min-w-[72px] rounded-lg bg-blue-50 px-2.5 py-1 text-right text-xs font-extrabold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                    +{t('goals.perMo', {
                      amt: formatMoney(extraDebtPayment, baseCurrency, privacyMode),
                    })}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                  {
                    label: t('goals.baselineCard'),
                    sim: debtComparison.baseline,
                    savedInterest: 0,
                    savedMonths: 0,
                    tone: 'border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/50',
                  },
                  {
                    label: t('goals.snowballCard'),
                    sim: debtComparison.snowball,
                    savedInterest: debtComparison.interestSavedSnowball,
                    savedMonths: debtComparison.monthsSavedSnowball,
                    tone: 'border-blue-200 bg-blue-50/40 dark:border-blue-900/60 dark:bg-blue-950/20',
                  },
                  {
                    label: t('goals.avalancheCard'),
                    sim: debtComparison.avalanche,
                    savedInterest: debtComparison.interestSavedAvalanche,
                    savedMonths: debtComparison.monthsSavedAvalanche,
                    tone: 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/20',
                  },
                ].map((card) => (
                  <div key={card.label} className={`rounded-xl border p-4 ${card.tone}`}>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      {card.label}
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-xl font-extrabold text-slate-900 dark:text-white">
                        {card.sim.monthsToPayoff === null
                          ? t('goals.monthsMax')
                          : t('goals.monthsVal', { m: card.sim.monthsToPayoff })}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {t('goals.interestVal', {
                          amt: formatMoney(card.sim.totalInterestPaid, baseCurrency, privacyMode),
                        })}
                      </span>
                    </div>
                    {card.savedMonths > 0 || card.savedInterest > 0 ? (
                      <div className="mt-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {t('goals.savesLine', {
                          months: card.savedMonths,
                          interest: formatMoney(card.savedInterest, baseCurrency, privacyMode),
                        })}
                      </div>
                    ) : (
                      <div className="mt-1.5 text-xs text-slate-500">{t('goals.minSchedule')}</div>
                    )}
                    {card.sim.payoffOrder.length > 0 && (
                      <div className="mt-2 truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {t('goals.orderLabel')}{' '}
                        {card.sim.payoffOrder
                          .map((p) => `${entityText(p.name)} (${t('goals.monthShort')} ${p.payoffMonth})`)
                          .join(' → ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {state.debts.map((debt) => {
              const paidPct =
                debt.originalAmount > 0
                  ? Math.round(
                      ((debt.originalAmount - debt.currentBalance) / debt.originalAmount) * 100
                    )
                  : 0;
              const monthsLeft = debtPayoffMonths(debt);
              const isPaying = payDebtId === debt.id;
              const isEditingDebt = editingDebtId === debt.id && debtDraft;

              return (
                <div
                  key={debt.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
                >
                  {isEditingDebt ? (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          type="text"
                          value={debtDraft.name}
                          onChange={(e) =>
                            setDebtDraft((d) => (d ? { ...d, name: e.target.value } : d))
                          }
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                        />
                        <input
                          type="text"
                          value={debtDraft.lender}
                          onChange={(e) =>
                            setDebtDraft((d) => (d ? { ...d, lender: e.target.value } : d))
                          }
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                        />
                        <input
                          type="number"
                          min="0"
                          value={debtDraft.currentBalance}
                          onChange={(e) =>
                            setDebtDraft((d) =>
                              d ? { ...d, currentBalance: e.target.value } : d
                            )
                          }
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                        />
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.1"
                            value={debtDraft.interestRateApr}
                            onChange={(e) =>
                              setDebtDraft((d) =>
                                d ? { ...d, interestRateApr: e.target.value } : d
                              )
                            }
                            className="w-1/2 rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                          />
                          <input
                            type="number"
                            value={debtDraft.minimumPayment}
                            onChange={(e) =>
                              setDebtDraft((d) =>
                                d ? { ...d, minimumPayment: e.target.value } : d
                              )
                            }
                            className="w-1/2 rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDebtId(null);
                            setDebtDraft(null);
                          }}
                          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                        >
                          {t('layout.cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveDebtEdit(debt)}
                          className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          {t('common.save')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {entityText(debt.name)}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t('goals.aprMinLine', {
                          lender: entityText(debt.lender),
                          apr: debt.interestRateApr,
                          amt: formatMoney(debt.minimumPayment, baseCurrency, privacyMode),
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => startEditDebt(debt)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
                        aria-label={t('goals.editDebtAria', { name: debt.name })}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDebt(debt.id)}
                        className="rounded p-1 text-slate-400 hover:text-rose-500"
                        aria-label={t('goals.deleteDebtAria', { name: debt.name })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs font-semibold">
                      <span className="text-rose-600 dark:text-rose-400">
                        {t('goals.remainingDebt', {
                          amt: formatMoney(debt.currentBalance, baseCurrency, privacyMode),
                        })}
                      </span>
                      <span className="text-slate-500">
                        {t('goals.paidPct', { pct: paidPct })} •{' '}
                        {monthsLeft === null
                          ? t('goals.payTooLow')
                          : t('goals.moLeft', { m: monthsLeft })}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all"
                        style={{ width: `${Math.max(0, Math.min(100, paidPct))}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                    {isPaying ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          className="w-28 rounded-lg border border-slate-300 px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            recordDebtPayment(
                              debt.id,
                              parseFloat(payAmount) || 0,
                              debt.accountId ?? state.accounts[0]?.id ?? '',
                              debt.ownerId
                            );
                            setPayDebtId(null);
                          }}
                          className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white"
                        >
                          {t('goals.postPayment')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayDebtId(null)}
                          className="text-xs text-slate-500"
                        >
                          {t('layout.cancel')}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setPayDebtId(debt.id);
                          setPayAmount(String(debt.minimumPayment));
                        }}
                        className="rounded-xl bg-slate-100 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-blue-600 hover:text-white dark:bg-slate-800 dark:text-slate-200"
                      >
                        {t('goals.recordDebtPay')}
                      </button>
                    )}
                  </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <form
            onSubmit={handleAddDebt}
            className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-6"
          >
            <input
              type="text"
              required
              value={debtName}
              onChange={(e) => setDebtName(e.target.value)}
              placeholder={t('goals.loanNamePlaceholder')}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs sm:col-span-2 dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              type="text"
              value={debtLender}
              onChange={(e) => setDebtLender(e.target.value)}
              placeholder={t('goals.lenderPlaceholder')}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              type="number"
              min="1"
              required
              value={debtBalance}
              onChange={(e) => setDebtBalance(e.target.value)}
              placeholder={t('goals.balancePlaceholder')}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                value={debtApr}
                onChange={(e) => setDebtApr(e.target.value)}
                placeholder={t('goals.aprPlaceholder')}
                className="w-1/2 rounded-xl border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                type="number"
                value={debtMinPay}
                onChange={(e) => setDebtMinPay(e.target.value)}
                placeholder={t('goals.minMoPlaceholder')}
                className="w-1/2 rounded-xl border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
            >
              <Plus className="h-4 w-4" /> {t('goals.addLoanBtn')}
            </button>
          </form>
        </section>
      )}
    </div>
  );
};
