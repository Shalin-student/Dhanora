import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import {
  compute503020Breakdown,
  computeCategorySpending,
  computeFinancialHealthScore,
  computeMemberSummaries,
  computeMonthlySummary,
  computeNetWorth,
  formatMonthLabel,
  shiftMonth,
  todayISO,
} from '../utils/calculations';
import { formatMoney } from '../utils/currency';
import { detectFinancialAnomalies } from '../utils/automation';
import { filterGoalsForActor } from '../utils/permissions';
import {
  computeBudgetPace,
  computeCashflowForecast,
  computeCategoryEnvelopesWithRollover,
} from '../utils/forecast';
import { computeNetWorthHistory } from '../utils/wealth';
import { computePortfolioSummary, computeWealthProjection } from '../utils/portfolio';
import { CashflowChart, CashflowForecastChart, CategoryDonutChart } from '../components/Charts';
import { useI18n } from '../i18n/useI18n';

export const DashboardView: React.FC = () => {
  const {
    state,
    activeProfile,
    roleCapabilities,
    selectedMonth,
    selectedMemberId,
    setActiveView,
    openQuickAdd,
    postRecurringDue,
  } = useFinance();
  const {
    language,
    t,
    formatMonth,
    catName,
    memName,
    accName,
    entityText,
    freqLabel,
  } = useI18n();

  const [forecastScope, setForecastScope] = useState<'checking' | 'liquid'>('checking');

  const { baseCurrency, privacyMode } = state.settings;
  const summary = computeMonthlySummary(state.transactions, selectedMonth, selectedMemberId);
  const prevSummary = computeMonthlySummary(
    state.transactions,
    shiftMonth(selectedMonth, -1),
    selectedMemberId
  );
  const netWorth = computeNetWorth(state);
  const portfolio = computePortfolioSummary(state);
  const proj10Yr = computeWealthProjection({
    startingCorpus: portfolio.totalCurrentValue,
    monthlySip: portfolio.activeMonthlySip,
    annualReturnPct: portfolio.weightedExpectedReturnPct,
    years: 10,
    language,
  });
  const catSpending = computeCategorySpending(
    state.transactions,
    state.categories,
    selectedMonth,
    'expense',
    selectedMemberId
  );
  const rule503020 = compute503020Breakdown(
    state.transactions,
    state.categories,
    selectedMonth,
    selectedMemberId
  );
  const health = computeFinancialHealthScore(state, selectedMonth, language);
  const memberSummaries = computeMemberSummaries(
    state.members,
    state.transactions,
    selectedMonth
  );

  // 6-month trend ending at selectedMonth
  const trendData = [-5, -4, -3, -2, -1, 0].map((offset) => {
    const mKey = shiftMonth(selectedMonth, offset);
    const s = computeMonthlySummary(state.transactions, mKey, selectedMemberId);
    return {
      label: formatMonthLabel(mKey, language).split(' ')[0],
      income: s.income,
      expense: s.expense,
      net: s.netSavings,
    };
  });

  const upcomingBills = state.recurring
    .filter((r) => r.isActive)
    .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))
    .slice(0, 4);

  const recentTransactions = state.transactions
    .filter(
      (tx) =>
        tx.date.startsWith(selectedMonth) &&
        (selectedMemberId === 'all' || tx.memberId === selectedMemberId)
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  const incomeDelta =
    prevSummary.income > 0
      ? Math.round(((summary.income - prevSummary.income) / prevSummary.income) * 100)
      : 0;
  const expenseDelta =
    prevSummary.expense > 0
      ? Math.round(((summary.expense - prevSummary.expense) / prevSummary.expense) * 100)
      : 0;

  const today = todayISO();

  // Scoped child/dependent dashboard (hides household salaries, mortgage, net worth, & brokerage)
  if (roleCapabilities.isDependent) {
    const myAllowance = activeProfile.monthlyAllowance;
    const myRemaining = Number((myAllowance - summary.expense).toFixed(2));
    const myUsedPct = myAllowance > 0 ? Math.min(100, Math.round((summary.expense / myAllowance) * 100)) : 0;
    const myGoals = filterGoalsForActor(state.goals, activeProfile);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {t('dash.depHeading', {
                avatar: activeProfile.avatar,
                name: memName(activeProfile),
              })}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('dash.depSubtitle', { month: formatMonth(selectedMonth) })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openQuickAdd(null)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            {t('dash.logMySpend')}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs font-semibold uppercase text-slate-500">
              {t('dash.monthlyAllowance')}
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
              {formatMoney(myAllowance, baseCurrency, privacyMode)}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs font-semibold uppercase text-slate-500">
              {t('dash.spentThisMonth')}
            </div>
            <div className="mt-2 text-2xl font-extrabold text-rose-600 dark:text-rose-400">
              {formatMoney(summary.expense, baseCurrency, privacyMode)}
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={`h-full rounded-full ${myUsedPct > 95 ? 'bg-rose-500' : 'bg-blue-600'}`}
                style={{ width: `${myUsedPct}%` }}
              />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs font-semibold uppercase text-slate-500">
              {t('dash.allowanceRemaining')}
            </div>
            <div
              className={`mt-2 text-2xl font-extrabold ${
                myRemaining >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatMoney(myRemaining, baseCurrency, privacyMode)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t('dash.myGoals')}
              </h2>
              <button
                type="button"
                onClick={() => setActiveView('goals')}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                {t('dash.openGoals')}
              </button>
            </div>
            {myGoals.length === 0 ? (
              <p className="text-xs text-slate-500">{t('dash.noGoalsYet')}</p>
            ) : (
              <div className="space-y-3">
                {myGoals.map((g) => {
                  const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
                  return (
                    <div key={g.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                      <div className="flex justify-between text-xs font-bold">
                        <span>
                          {g.icon} {entityText(g.name)}
                        </span>
                        <span>{pct}%</span>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t('dash.myRecentActivity')}
              </h2>
              <button
                type="button"
                onClick={() => setActiveView('transactions')}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                {t('dash.fullLedger')}
              </button>
            </div>
            {recentTransactions.length === 0 ? (
              <p className="text-xs text-slate-500">{t('dash.noPersonalTx')}</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2 text-xs">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">{tx.merchant}</div>
                      <div className="text-slate-500">{tx.date}</div>
                    </div>
                    <div className="font-bold">
                      {tx.type === 'income' ? '+' : '-'}
                      {formatMoney(tx.amount, tx.currency, privacyMode)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const smartAlerts = detectFinancialAnomalies(state, selectedMonth, today, language).slice(0, 3);
  const envelopes = computeCategoryEnvelopesWithRollover(
    state.transactions,
    state.categories,
    selectedMonth,
    selectedMemberId
  );
  const totalAvailableBudget = envelopes.reduce((s, e) => s + e.availableBudget, 0);
  const pace = computeBudgetPace(selectedMonth, totalAvailableBudget, summary.expense, today);
  const lowThreshold = forecastScope === 'checking' ? 1000 : 5000;
  const forecast = computeCashflowForecast(state, {
    scope: forecastScope,
    horizonDays: 90,
    startDate: today,
    lowBalanceThreshold: lowThreshold,
    language,
  });
  const netWorthHistory = computeNetWorthHistory(state, selectedMonth, 6, language);
  const netWorth6MoDelta =
    netWorthHistory.length >= 2
      ? Number(
          (
            netWorthHistory[netWorthHistory.length - 1].netWorth - netWorthHistory[0].netWorth
          ).toFixed(2)
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {t('dash.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {formatMonth(selectedMonth)} •{' '}
            {selectedMemberId === 'all'
              ? t('dash.entireFamily')
              : memName(state.members.find((m) => m.id === selectedMemberId))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveView('reports')}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {t('dash.monthlyStatement')}
          </button>
          <button
            type="button"
            onClick={() => openQuickAdd(null)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            {t('dash.quickEntry')}
          </button>
        </div>
      </div>

      {smartAlerts.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-950/20">
          <div className="flex items-center gap-2.5 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              <strong className="text-slate-900 dark:text-white">
                {smartAlerts[0].title}:
              </strong>{' '}
              <span className="text-slate-600 dark:text-slate-300">
                {smartAlerts[0].detail}
              </span>
              {smartAlerts.length > 1 && (
                <span className="ml-1.5 font-semibold text-amber-700 dark:text-amber-300">
                  {t('dash.moreAlerts', { count: smartAlerts.length - 1 })}
                </span>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveView('automation')}
            className="text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
          >
            {t('dash.reviewAlerts')}
          </button>
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('dash.monthlyIncome')}
            </span>
            <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            {formatMoney(summary.income, baseCurrency, privacyMode)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('dash.vsPriorMonth', {
              delta: incomeDelta >= 0 ? `+${incomeDelta}%` : `${incomeDelta}%`,
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('dash.monthlySpending')}
            </span>
            <span className="rounded-lg bg-rose-50 p-2 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
              <ArrowDownRight className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            {formatMoney(summary.expense, baseCurrency, privacyMode)}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              {t('dash.vsPriorShort', {
                delta: expenseDelta >= 0 ? `+${expenseDelta}%` : `${expenseDelta}%`,
              })}
            </span>
            <span>•</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {t('dash.safePerDay', {
                amt: formatMoney(pace.dailySafeToSpend, baseCurrency, privacyMode),
              })}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('dash.netCashflow')}
            </span>
            <span className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <Sparkles className="h-4 w-4" />
            </span>
          </div>
          <div
            className={`mt-2 text-2xl font-extrabold ${
              summary.netSavings >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {summary.netSavings >= 0 ? '+' : ''}
            {formatMoney(summary.netSavings, baseCurrency, privacyMode)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('dash.savingsRate')} <span className="font-semibold">{summary.savingsRate}%</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('dash.familyNetWorth')}
            </span>
            <span className="rounded-lg bg-violet-50 p-2 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400">
              <Wallet className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            {formatMoney(netWorth.netWorth, baseCurrency, privacyMode)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('dash.assetsShort', {
              amt: formatMoney(netWorth.assets, baseCurrency, privacyMode, true),
            })}{' '}
            • {t('dash.sixMonthTag')}{' '}
            <span
              className={
                netWorth6MoDelta >= 0
                  ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                  : 'font-semibold text-rose-600 dark:text-rose-400'
              }
            >
              {netWorth6MoDelta >= 0 ? '+' : ''}
              {formatMoney(netWorth6MoDelta, baseCurrency, privacyMode, true)}
            </span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t('dash.trendTitle')}
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t('dash.incomeVsSpend')}
            </span>
          </div>
          <CashflowChart data={trendData} currency={baseCurrency} privacyMode={privacyMode} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t('dash.spendingByCategory')}
            </h2>
            <button
              type="button"
              onClick={() => setActiveView('budgets')}
              className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              {t('dash.manageBudgets')}
            </button>
          </div>
          <CategoryDonutChart
            slices={catSpending.map((c) => ({
              id: c.category.id,
              label: catName(c.category),
              value: c.spent,
              color: c.category.color,
              icon: c.category.icon,
            }))}
            currency={baseCurrency}
            privacyMode={privacyMode}
          />
        </div>
      </div>

      {/* 90-Day Liquid Cashflow Forecast */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t('dash.forecastTitle')}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('dash.forecastDesc')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-slate-100 p-1 text-xs dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setForecastScope('checking')}
                className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                  forecastScope === 'checking'
                    ? 'bg-white text-blue-600 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {t('dash.checkingCash')}
              </button>
              <button
                type="button"
                onClick={() => setForecastScope('liquid')}
                className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                  forecastScope === 'liquid'
                    ? 'bg-white text-blue-600 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {t('dash.allLiquid')}
              </button>
            </div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <div className="text-[11px] text-slate-500">{t('dash.currentBalance')}</div>
            <div className="text-sm font-extrabold text-slate-900 dark:text-white">
              {formatMoney(forecast.startingBalance, baseCurrency, privacyMode)}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <div className="text-[11px] text-slate-500">{t('dash.in90Days')}</div>
            <div className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
              {formatMoney(forecast.endingBalance, baseCurrency, privacyMode)}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <div className="text-[11px] text-slate-500">{t('dash.netDelta90')}</div>
            <div
              className={`text-sm font-extrabold ${
                forecast.netProjectedChange >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {forecast.netProjectedChange >= 0 ? '+' : ''}
              {formatMoney(forecast.netProjectedChange, baseCurrency, privacyMode)}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <div className="text-[11px] text-slate-500">
              {t('dash.lowestPoint', { date: forecast.lowestDate.slice(5) })}
            </div>
            <div
              className={`text-sm font-extrabold ${
                forecast.lowestBalance < lowThreshold
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {formatMoney(forecast.lowestBalance, baseCurrency, privacyMode)}
            </div>
          </div>
        </div>

        {forecast.lowBalanceAlerts.length > 0 && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            {t('dash.lowBalAlert', {
              threshold: formatMoney(lowThreshold, baseCurrency, privacyMode),
              date: forecast.lowBalanceAlerts[0].date,
              balance: formatMoney(forecast.lowBalanceAlerts[0].balance, baseCurrency, privacyMode),
            })}
          </div>
        )}

        <CashflowForecastChart
          points={forecast.points}
          currency={baseCurrency}
          privacyMode={privacyMode}
          lowThreshold={lowThreshold}
        />
      </div>

      {/* Financial Health Score + 50/30/20 + Member Pulse */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Financial Health */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t('dash.healthTitle')}
              </h2>
            </div>
            <span className="rounded-xl bg-emerald-100 px-2.5 py-1 text-xs font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              {t('dash.scoreGrade', { score: health.score, grade: health.grade })}
            </span>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/70">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('dash.healthSavingsRate')}
              </div>
              <div className="text-sm font-bold">{health.savingsRate}%</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/70">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('dash.healthRunway')}
              </div>
              <div className="text-sm font-bold">
                {t('dash.healthMonthsVal', { m: health.emergencyMonths })}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/70">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('dash.healthOnBudget')}
              </div>
              <div className="text-sm font-bold">{health.budgetAdherencePct}%</div>
            </div>
          </div>

          <ul className="space-y-2">
            {health.insights.map((tip, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300"
              >
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 50/30/20 Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t('dash.ruleTitle')}
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t('dash.targetRatio')}
            </span>
          </div>

          <div className="space-y-4">
            {[
              {
                label: t('dash.needsTarget'),
                pct: rule503020.needsPct,
                target: 50,
                amount: rule503020.needs,
                bar: 'bg-blue-500',
              },
              {
                label: t('dash.wantsTarget'),
                pct: rule503020.wantsPct,
                target: 30,
                amount: rule503020.wants,
                bar: 'bg-amber-500',
              },
              {
                label: t('dash.savingsTarget'),
                pct: rule503020.savingsPct,
                target: 20,
                amount: rule503020.savings,
                bar: 'bg-emerald-500',
              },
            ].map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {row.label}
                  </span>
                  <span className="font-bold">
                    {row.pct}% ({formatMoney(row.amount, baseCurrency, privacyMode, true)})
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full ${row.bar}`}
                    style={{ width: `${Math.min(100, row.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Family Member Activity */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t('dash.familyContrib')}
            </h2>
            <button
              type="button"
              onClick={() => setActiveView('family')}
              className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              {t('dash.detailsArrow')}
            </button>
          </div>
          <div className="space-y-3">
            {memberSummaries.map((ms) => (
              <div
                key={ms.member.id}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{ms.member.avatar}</span>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {memName(ms.member)}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t('dash.allowanceUsedPct', { pct: ms.allowanceUsedPct })}
                    </div>
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                    +{formatMoney(ms.income, baseCurrency, privacyMode, true)}
                  </div>
                  <div className="font-semibold text-rose-600 dark:text-rose-400">
                    -{formatMoney(ms.expense, baseCurrency, privacyMode, true)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Portfolio & 10-Year Projection Pulse */}
      <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/70 via-white to-blue-50/60 p-5 shadow-xs dark:border-emerald-900/50 dark:from-emerald-950/30 dark:via-slate-900 dark:to-blue-950/20">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t('dash.portfolioPulseTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setActiveView('accounts')}
            className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            {t('dash.openPortfolio')}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div className="text-[11px] text-slate-500">{t('inv.portfolioValue')}</div>
            <div className="text-lg font-extrabold text-slate-900 dark:text-white">
              {formatMoney(portfolio.totalCurrentValue, baseCurrency, privacyMode)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">{t('inv.unrealizedGain')}</div>
            <div
              className={`text-lg font-extrabold ${
                portfolio.totalGain >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {portfolio.totalGain >= 0 ? '+' : ''}
              {formatMoney(portfolio.totalGain, baseCurrency, privacyMode)} ({portfolio.totalGainPct}
              %)
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">{t('inv.monthlySip')}</div>
            <div className="text-lg font-extrabold text-blue-600 dark:text-blue-400">
              {formatMoney(portfolio.activeMonthlySip, baseCurrency, privacyMode)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">{t('dash.proj10YrShort')}</div>
            <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300">
              {formatMoney(proj10Yr.finalValue, baseCurrency, privacyMode)}
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Bills & Recent Transactions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t('dash.upcomingBills')}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveView('bills')}
              className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              {t('dash.viewAll')}
            </button>
          </div>

          <div className="space-y-2.5">
            {upcomingBills.map((bill) => {
              const isOverdue = bill.nextDueDate < today;
              return (
                <div
                  key={bill.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 p-3 dark:border-slate-800"
                >
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                      {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                      <span>{entityText(bill.title)}</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {t('dash.dueLine', {
                        date: bill.nextDueDate,
                        freq: freqLabel(bill.frequency),
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-bold ${
                        bill.type === 'income'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {bill.type === 'income' ? '+' : ''}
                      {formatMoney(bill.amount, bill.currency, privacyMode)}
                    </span>
                    <button
                      type="button"
                      onClick={() => postRecurringDue(bill.id)}
                      className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-blue-600 hover:text-white dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-blue-600"
                    >
                      {t('dash.post')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t('dash.recentActivity', { month: formatMonth(selectedMonth) })}
            </h2>
            <button
              type="button"
              onClick={() => setActiveView('transactions')}
              className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              {t('dash.fullLedger')}
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">{t('dash.noTxMonth')}</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentTransactions.map((tx) => {
                const cat = state.categories.find((c) => c.id === tx.categoryId);
                const member = state.members.find((m) => m.id === tx.memberId);
                const account = state.accounts.find((a) => a.id === tx.accountId);
                return (
                  <div
                    key={tx.id}
                    onClick={() => openQuickAdd(tx)}
                    className="flex cursor-pointer items-center justify-between py-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-base dark:bg-slate-800">
                        {cat?.icon ?? '💳'}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {entityText(tx.merchant)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {tx.date} • {cat ? catName(cat) : t('tx.transfer')} • {member?.avatar}{' '}
                          {memName(member)} • {accName(account)}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`ml-3 shrink-0 whitespace-nowrap text-sm font-bold ${
                        tx.type === 'income'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : tx.type === 'transfer'
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '⇄ '}
                      {formatMoney(tx.amount, tx.currency, privacyMode)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
