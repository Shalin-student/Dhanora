import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Eye,
  EyeOff,
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
import { StarterTemplatesModal } from '../components/StarterTemplatesModal';
import { HouseholdAvatarStack, MemberRoleAvatar } from '../components/WdwPrimitives';
import { useI18n } from '../i18n/useI18n';

export const DashboardView: React.FC = () => {
  const {
    state,
    authSession,
    activeProfile,
    roleCapabilities,
    selectedMonth,
    selectedMemberId,
    setActiveView,
    openQuickAdd,
    postRecurringDue,
    updateSettings,
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
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);

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
            <h1 className="text-2xl font-bold tracking-tight text-[#131b2e] dark:text-white">
              {t('dash.depHeading', {
                avatar: activeProfile.avatar,
                name: memName(activeProfile),
              })}
            </h1>
            <p className="text-sm text-[#404944] dark:text-[#bfc9c3]">
              {t('dash.depSubtitle', { month: formatMonth(selectedMonth) })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openQuickAdd(null)}
            className="wdw-btn-primary inline-flex min-h-[40px] items-center gap-1.5 px-4 py-2 text-xs font-semibold shadow-sm"
          >
            <Plus className="h-4 w-4" />
            {t('dash.logMySpend')}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="wdw-hero-vault p-6">
            <div className="label-caps text-[#A7F3D0]">
              {t('dash.monthlyAllowance')}
            </div>
            <div className="font-numeric mt-2 text-2xl font-bold text-white">
              {formatMoney(myAllowance, baseCurrency, privacyMode)}
            </div>
          </div>
          <div className="wdw-card p-6">
            <div className="label-caps text-[#404944] dark:text-[#bfc9c3]">
              {t('dash.spentThisMonth')}
            </div>
            <div className="font-numeric mt-2 text-2xl font-bold text-[#904d00] dark:text-[#fe932c]">
              {formatMoney(summary.expense, baseCurrency, privacyMode)}
            </div>
            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#eaedff] dark:bg-[#1c2640]">
              <div
                className={`h-full rounded-full ${myUsedPct > 95 ? 'bg-[#ba1a1a]' : 'bg-[#D97706]'}`}
                style={{ width: `${myUsedPct}%` }}
              />
            </div>
          </div>
          <div className="wdw-card p-6">
            <div className="label-caps text-[#404944] dark:text-[#bfc9c3]">
              {t('dash.allowanceRemaining')}
            </div>
            <div
              className={`font-numeric mt-2 text-2xl font-bold ${
                myRemaining >= 0
                  ? 'text-[#10B981]'
                  : 'text-[#ba1a1a] dark:text-[#ffdad6]'
              }`}
            >
              {formatMoney(myRemaining, baseCurrency, privacyMode)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="wdw-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#131b2e] dark:text-white">
                {t('dash.myGoals')}
              </h2>
              <button
                type="button"
                onClick={() => setActiveView('goals')}
                className="text-xs font-semibold text-[#0F766E] hover:underline dark:text-[#6ac0b6]"
              >
                {t('dash.openGoals')}
              </button>
            </div>
            {myGoals.length === 0 ? (
              <p className="text-xs text-[#404944] dark:text-[#bfc9c3]">{t('dash.noGoalsYet')}</p>
            ) : (
              <div className="space-y-3">
                {myGoals.map((g) => {
                  const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
                  return (
                    <div key={g.id} className="wdw-surface-tier rounded-xl p-3">
                      <div className="flex justify-between text-xs font-semibold">
                        <span>
                          {g.icon} {entityText(g.name)}
                        </span>
                        <span className="font-numeric text-[#064E3B] dark:text-[#b0f0d6]">{pct}%</span>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#dae2fd] dark:bg-[#232f4f]">
                        <div className="h-full rounded-full bg-[#10B981]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="wdw-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#131b2e] dark:text-white">
                {t('dash.myRecentActivity')}
              </h2>
              <button
                type="button"
                onClick={() => setActiveView('transactions')}
                className="text-xs font-semibold text-[#0F766E] hover:underline dark:text-[#6ac0b6]"
              >
                {t('dash.fullLedger')}
              </button>
            </div>
            {recentTransactions.length === 0 ? (
              <p className="text-xs text-[#404944] dark:text-[#bfc9c3]">{t('dash.noPersonalTx')}</p>
            ) : (
              <div className="divide-y divide-[#F1F5F9] dark:divide-[#232f4f]">
                {recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2.5 text-xs">
                    <div>
                      <div className="font-semibold text-[#131b2e] dark:text-white">{tx.merchant}</div>
                      <div className="font-numeric text-[#404944] dark:text-[#bfc9c3]">{tx.date}</div>
                    </div>
                    <div
                      className={`font-numeric font-semibold ${
                        tx.type === 'income' ? 'text-[#10B981]' : 'text-[#131b2e] dark:text-white'
                      }`}
                    >
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

  const step1Done = state.accounts.some((a) => a.initialBalance > 0);
  const step2Done = state.transactions.length > 0;
  const step3Done = state.goals.length > 0 || (state.sips ?? []).length > 0;
  const step4Done =
    state.accounts.some((a) => Boolean(a.nomineeName?.trim())) ||
    (state.policies ?? []).length > 0;
  const completedStepsCount = [step1Done, step2Done, step3Done, step4Done].filter(Boolean).length;
  const showShieldChecklist =
    !roleCapabilities.isDependent &&
    !state.settings.onboardingChecklistDismissed &&
    completedStepsCount < 4;

  return (
    <div className="space-y-8">
      <StarterTemplatesModal
        open={templatesModalOpen}
        onClose={() => setTemplatesModalOpen(false)}
      />

      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#131b2e] sm:text-[32px] sm:leading-[40px] dark:text-white">
            {t('dash.title')}
          </h1>
          <p className="mt-0.5 text-sm text-[#404944] dark:text-[#bfc9c3]">
            {formatMonth(selectedMonth)} •{' '}
            {selectedMemberId === 'all'
              ? t('dash.entireFamily')
              : memName(state.members.find((m) => m.id === selectedMemberId))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {state.transactions.length === 0 && roleCapabilities.canDeleteHouseholdData && (
            <button
              type="button"
              onClick={() => setTemplatesModalOpen(true)}
              className="wdw-btn-secondary inline-flex min-h-[40px] items-center gap-1.5 px-3.5 py-2 text-xs font-semibold"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t('onb.useStarterBannerBtn')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveView('reports')}
            className="min-h-[40px] rounded-lg border border-[#bfc9c3]/70 bg-white px-3.5 py-2 text-xs font-semibold text-[#131b2e] hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:bg-[#131b2e] dark:text-[#eef0ff] dark:hover:bg-[#1c2640]"
          >
            {t('dash.monthlyStatement')}
          </button>
          <button
            type="button"
            onClick={() => openQuickAdd(null)}
            className="wdw-btn-primary inline-flex min-h-[40px] items-center gap-1.5 px-4 py-2 text-xs font-semibold shadow-sm"
          >
            <Plus className="h-4 w-4" />
            {t('dash.quickEntry')}
          </button>
        </div>
      </div>

      {/* 4-Step Family Financial Shield Onboarding Checklist */}
      {showShieldChecklist && (!authSession || !authSession.isDemo || state.transactions.length === 0) && (
        <div className="wdw-card-elevated rounded-2xl border border-[#064E3B]/15 bg-gradient-to-r from-[#b0f0d6]/25 via-white to-[#FEF3C7]/45 p-5 dark:border-[#80bea6]/20 dark:from-[#064E3B]/30 dark:via-[#131b2e] dark:to-[#904d00]/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#064E3B] dark:text-[#b0f0d6]" />
              <span className="text-xs font-bold text-[#131b2e] dark:text-white">
                {t('onb.shieldTitle')}
              </span>
              <span className="font-numeric rounded-full bg-[#064E3B]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#064E3B] dark:bg-[#064E3B]/50 dark:text-[#b0f0d6]">
                {t('onb.shieldProgress', { done: completedStepsCount })}
              </span>
            </div>
            <button
              type="button"
              onClick={() => updateSettings({ onboardingChecklistDismissed: true })}
              className="text-[11px] font-semibold text-[#404944] hover:text-[#131b2e] dark:text-[#bfc9c3]"
            >
              {t('onb.dismiss')}
            </button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                done: step1Done,
                label: t('onb.step1'),
                onClick: () => setActiveView('accounts'),
              },
              {
                done: step2Done,
                label: t('onb.step2'),
                onClick: () => openQuickAdd(null),
              },
              {
                done: step3Done,
                label: t('onb.step3'),
                onClick: () => setActiveView('goals'),
              },
              {
                done: step4Done,
                label: t('onb.step4'),
                onClick: () =>
                  setActiveView(roleCapabilities.allowedViews.includes('safety') ? 'safety' : 'accounts'),
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-semibold transition ${
                  item.done
                    ? 'border-[#10B981]/30 bg-[#b0f0d6]/30 text-[#064E3B] dark:border-[#0F766E] dark:bg-[#064E3B]/40 dark:text-[#b0f0d6]'
                    : 'border-[#bfc9c3]/50 bg-white text-[#131b2e] hover:border-[#0F766E] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-[#eef0ff]'
                }`}
              >
                <CheckCircle2
                  className={`h-4 w-4 shrink-0 ${
                    item.done ? 'text-[#10B981]' : 'text-[#bfc9c3] dark:text-[#707974]'
                  }`}
                />
                <span className={item.done ? 'line-through opacity-75' : ''}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {smartAlerts.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#FCD34D] bg-[#FEF3C7] px-4 py-3 dark:border-[#904d00] dark:bg-[#904d00]/25">
          <div className="flex items-center gap-2.5 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[#D97706]" />
            <span>
              <strong className="text-[#2f1500] dark:text-[#ffdcc3]">
                {smartAlerts[0].title}:
              </strong>{' '}
              <span className="text-[#663500] dark:text-[#ffdcc3]/90">
                {smartAlerts[0].detail}
              </span>
              {smartAlerts.length > 1 && (
                <span className="ml-1.5 font-semibold text-[#904d00] dark:text-[#ffb77d]">
                  {t('dash.moreAlerts', { count: smartAlerts.length - 1 })}
                </span>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveView('automation')}
            className="text-xs font-semibold text-[#064E3B] hover:underline dark:text-[#b0f0d6]"
          >
            {t('dash.reviewAlerts')}
          </button>
        </div>
      )}

      {/* Top KPI Banking Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="wdw-card p-6">
          <div className="flex items-center justify-between">
            <span className="label-caps text-[#404944] dark:text-[#bfc9c3]">
              {t('dash.monthlyIncome')}
            </span>
            <span className="rounded-lg bg-[#0F766E]/10 p-2 text-[#0F766E] dark:bg-[#004d47]/50 dark:text-[#6ac0b6]">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
          <div className="font-numeric mt-2.5 text-2xl font-bold text-[#131b2e] dark:text-white">
            {formatMoney(summary.income, baseCurrency, privacyMode)}
          </div>
          <div className="font-numeric mt-1.5 text-xs font-medium text-[#0F766E] dark:text-[#6ac0b6]">
            {t('dash.vsPriorMonth', {
              delta: incomeDelta >= 0 ? `+${incomeDelta}%` : `${incomeDelta}%`,
            })}
          </div>
        </div>

        <div className="wdw-card p-6">
          <div className="flex items-center justify-between">
            <span className="label-caps text-[#404944] dark:text-[#bfc9c3]">
              {t('dash.monthlySpending')}
            </span>
            <span className="rounded-lg bg-[#FEF3C7] p-2 text-[#D97706] dark:bg-[#904d00]/40 dark:text-[#fe932c]">
              <ArrowDownRight className="h-4 w-4" />
            </span>
          </div>
          <div className="font-numeric mt-2.5 text-2xl font-bold text-[#131b2e] dark:text-white">
            {formatMoney(summary.expense, baseCurrency, privacyMode)}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[#404944] dark:text-[#bfc9c3]">
            <span className="font-numeric">
              {t('dash.vsPriorShort', {
                delta: expenseDelta >= 0 ? `+${expenseDelta}%` : `${expenseDelta}%`,
              })}
            </span>
            <span>•</span>
            <span className="font-numeric rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-semibold text-[#904d00] dark:bg-[#904d00]/40 dark:text-[#ffdcc3]">
              {t('dash.safePerDay', {
                amt: formatMoney(pace.dailySafeToSpend, baseCurrency, privacyMode),
              })}
            </span>
          </div>
        </div>

        <div className="wdw-card p-6">
          <div className="flex items-center justify-between">
            <span className="label-caps text-[#404944] dark:text-[#bfc9c3]">
              {t('dash.netCashflow')}
            </span>
            <span className="rounded-lg bg-[#10B981]/12 p-2 text-[#064E3B] dark:bg-[#064E3B]/50 dark:text-[#b0f0d6]">
              <Sparkles className="h-4 w-4" />
            </span>
          </div>
          <div
            className={`font-numeric mt-2.5 text-2xl font-bold ${
              summary.netSavings >= 0
                ? 'text-[#10B981]'
                : 'text-[#ba1a1a] dark:text-[#ffdad6]'
            }`}
          >
            {summary.netSavings >= 0 ? '+' : ''}
            {formatMoney(summary.netSavings, baseCurrency, privacyMode)}
          </div>
          <div className="mt-1.5 text-xs text-[#404944] dark:text-[#bfc9c3]">
            {t('dash.savingsRate')}{' '}
            <span className="font-numeric font-semibold text-[#064E3B] dark:text-[#b0f0d6]">
              {summary.savingsRate}%
            </span>
          </div>
        </div>

        {/* Signature Shared Household Net Worth Vault Card */}
        <div className="wdw-hero-vault flex flex-col justify-between p-6">
          <div className="flex items-center justify-between gap-2">
            <span className="label-caps inline-flex items-center gap-1.5 text-[#A7F3D0]">
              <Wallet className="h-3.5 w-3.5" />
              {t('dash.familyNetWorth')}
            </span>
            <div className="flex items-center gap-2">
              <HouseholdAvatarStack members={state.members} max={3} />
              <button
                type="button"
                onClick={() => updateSettings({ privacyMode: !privacyMode })}
                aria-label={privacyMode ? 'Show net worth amounts' : 'Mask net worth amounts'}
                title={t('layout.privacyTitle')}
                className="rounded-lg bg-white/10 p-1.5 text-[#A7F3D0] transition hover:bg-white/20 hover:text-white"
              >
                {privacyMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <div className="font-numeric mt-2.5 text-2xl font-bold text-white">
            {formatMoney(netWorth.netWorth, baseCurrency, privacyMode)}
          </div>
          <div className="font-numeric mt-1.5 text-xs text-[#A7F3D0]">
            {t('dash.assetsShort', {
              amt: formatMoney(netWorth.assets, baseCurrency, privacyMode, true),
            })}{' '}
            • {t('dash.sixMonthTag')}{' '}
            <span className="font-semibold text-white">
              {netWorth6MoDelta >= 0 ? '+' : ''}
              {formatMoney(netWorth6MoDelta, baseCurrency, privacyMode, true)}
            </span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="wdw-card p-6 lg:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#131b2e] dark:text-white">
              {t('dash.trendTitle')}
            </h2>
            <span className="text-xs text-[#404944] dark:text-[#bfc9c3]">
              {t('dash.incomeVsSpend')}
            </span>
          </div>
          <CashflowChart data={trendData} currency={baseCurrency} privacyMode={privacyMode} />
        </div>

        <div className="wdw-card p-6 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#131b2e] dark:text-white">
              {t('dash.spendingByCategory')}
            </h2>
            <button
              type="button"
              onClick={() => setActiveView('budgets')}
              className="text-xs font-semibold text-[#0F766E] hover:underline dark:text-[#6ac0b6]"
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
      <div className="wdw-card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#0F766E]" />
              <h2 className="text-base font-semibold text-[#131b2e] dark:text-white">
                {t('dash.forecastTitle')}
              </h2>
            </div>
            <p className="text-xs text-[#404944] dark:text-[#bfc9c3]">
              {t('dash.forecastDesc')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg bg-[#f2f3ff] p-1 text-xs dark:bg-[#172036]">
              <button
                type="button"
                onClick={() => setForecastScope('checking')}
                className={`rounded-md px-2.5 py-1 font-semibold transition ${
                  forecastScope === 'checking'
                    ? 'bg-white text-[#064E3B] shadow-2xs dark:bg-[#232f4f] dark:text-white'
                    : 'text-[#404944] dark:text-[#bfc9c3]'
                }`}
              >
                {t('dash.checkingCash')}
              </button>
              <button
                type="button"
                onClick={() => setForecastScope('liquid')}
                className={`rounded-md px-2.5 py-1 font-semibold transition ${
                  forecastScope === 'liquid'
                    ? 'bg-white text-[#064E3B] shadow-2xs dark:bg-[#232f4f] dark:text-white'
                    : 'text-[#404944] dark:text-[#bfc9c3]'
                }`}
              >
                {t('dash.allLiquid')}
              </button>
            </div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="wdw-surface-tier rounded-xl p-3">
            <div className="text-[11px] text-[#404944] dark:text-[#bfc9c3]">{t('dash.currentBalance')}</div>
            <div className="font-numeric text-sm font-bold text-[#131b2e] dark:text-white">
              {formatMoney(forecast.startingBalance, baseCurrency, privacyMode)}
            </div>
          </div>
          <div className="wdw-surface-tier rounded-xl p-3">
            <div className="text-[11px] text-[#404944] dark:text-[#bfc9c3]">{t('dash.in90Days')}</div>
            <div className="font-numeric text-sm font-bold text-[#0F766E] dark:text-[#6ac0b6]">
              {formatMoney(forecast.endingBalance, baseCurrency, privacyMode)}
            </div>
          </div>
          <div className="wdw-surface-tier rounded-xl p-3">
            <div className="text-[11px] text-[#404944] dark:text-[#bfc9c3]">{t('dash.netDelta90')}</div>
            <div
              className={`font-numeric text-sm font-bold ${
                forecast.netProjectedChange >= 0
                  ? 'text-[#10B981]'
                  : 'text-[#ba1a1a]'
              }`}
            >
              {forecast.netProjectedChange >= 0 ? '+' : ''}
              {formatMoney(forecast.netProjectedChange, baseCurrency, privacyMode)}
            </div>
          </div>
          <div className="wdw-surface-tier rounded-xl p-3">
            <div className="text-[11px] text-[#404944] dark:text-[#bfc9c3]">
              {t('dash.lowestPoint', { date: forecast.lowestDate.slice(5) })}
            </div>
            <div
              className={`font-numeric text-sm font-bold ${
                forecast.lowestBalance < lowThreshold
                  ? 'text-[#D97706]'
                  : 'text-[#131b2e] dark:text-white'
              }`}
            >
              {formatMoney(forecast.lowestBalance, baseCurrency, privacyMode)}
            </div>
          </div>
        </div>

        {forecast.lowBalanceAlerts.length > 0 && (
          <div className="mb-3 rounded-lg border border-[#FCD34D] bg-[#FEF3C7] px-3 py-2 text-xs font-semibold text-[#904d00] dark:border-[#904d00] dark:bg-[#904d00]/30 dark:text-[#ffdcc3]">
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
        <div className="wdw-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#064E3B] dark:text-[#b0f0d6]" />
              <h2 className="text-base font-semibold text-[#131b2e] dark:text-white">
                {t('dash.healthTitle')}
              </h2>
            </div>
            <span className="font-numeric rounded-full bg-[#b0f0d6]/60 px-2.5 py-1 text-xs font-bold text-[#002117] dark:bg-[#064E3B] dark:text-[#b0f0d6]">
              {t('dash.scoreGrade', { score: health.score, grade: health.grade })}
            </span>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2 text-center">
            <div className="wdw-surface-tier rounded-xl p-2.5">
              <div className="text-[11px] text-[#404944] dark:text-[#bfc9c3]">
                {t('dash.healthSavingsRate')}
              </div>
              <div className="font-numeric text-sm font-bold text-[#064E3B] dark:text-[#b0f0d6]">
                {health.savingsRate}%
              </div>
            </div>
            <div className="wdw-surface-tier rounded-xl p-2.5">
              <div className="text-[11px] text-[#404944] dark:text-[#bfc9c3]">
                {t('dash.healthRunway')}
              </div>
              <div className="font-numeric text-sm font-bold text-[#131b2e] dark:text-white">
                {t('dash.healthMonthsVal', { m: health.emergencyMonths })}
              </div>
            </div>
            <div className="wdw-surface-tier rounded-xl p-2.5">
              <div className="text-[11px] text-[#404944] dark:text-[#bfc9c3]">
                {t('dash.healthOnBudget')}
              </div>
              <div className="font-numeric text-sm font-bold text-[#0F766E] dark:text-[#6ac0b6]">
                {health.budgetAdherencePct}%
              </div>
            </div>
          </div>

          <ul className="space-y-2">
            {health.insights.map((tip, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-xs text-[#404944] dark:text-[#bfc9c3]"
              >
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#10B981]" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 50/30/20 Breakdown */}
        <div className="wdw-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#131b2e] dark:text-white">
              {t('dash.ruleTitle')}
            </h2>
            <span className="font-numeric text-xs text-[#404944] dark:text-[#bfc9c3]">
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
                bar: 'bg-[#064E3B] dark:bg-[#0F766E]',
              },
              {
                label: t('dash.wantsTarget'),
                pct: rule503020.wantsPct,
                target: 30,
                amount: rule503020.wants,
                bar: 'bg-[#D97706]',
              },
              {
                label: t('dash.savingsTarget'),
                pct: rule503020.savingsPct,
                target: 20,
                amount: rule503020.savings,
                bar: 'bg-[#10B981]',
              },
            ].map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#131b2e] dark:text-[#eef0ff]">
                    {row.label}
                  </span>
                  <span className="font-numeric font-bold text-[#131b2e] dark:text-white">
                    {row.pct}% ({formatMoney(row.amount, baseCurrency, privacyMode, true)})
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#eaedff] dark:bg-[#1c2640]">
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
        <div className="wdw-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#131b2e] dark:text-white">
              {t('dash.familyContrib')}
            </h2>
            <button
              type="button"
              onClick={() => setActiveView('family')}
              className="text-xs font-semibold text-[#0F766E] hover:underline dark:text-[#6ac0b6]"
            >
              {t('dash.detailsArrow')}
            </button>
          </div>
          <div className="space-y-3">
            {memberSummaries.map((ms) => (
              <div
                key={ms.member.id}
                className="wdw-surface-tier flex items-center justify-between rounded-xl px-3 py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <MemberRoleAvatar
                    avatar={ms.member.avatar}
                    role={ms.member.role}
                    name={memName(ms.member)}
                    size="sm"
                  />
                  <div>
                    <div className="text-xs font-semibold text-[#131b2e] dark:text-white">
                      {memName(ms.member)}
                    </div>
                    <div className="font-numeric text-[11px] text-[#404944] dark:text-[#bfc9c3]">
                      {t('dash.allowanceUsedPct', { pct: ms.allowanceUsedPct })}
                    </div>
                  </div>
                </div>
                <div className="font-numeric text-right text-xs">
                  <div className="font-semibold text-[#10B981]">
                    +{formatMoney(ms.income, baseCurrency, privacyMode, true)}
                  </div>
                  <div className="font-semibold text-[#904d00] dark:text-[#ffb77d]">
                    -{formatMoney(ms.expense, baseCurrency, privacyMode, true)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Portfolio & 10-Year Projection Pulse */}
      <div className="wdw-card border border-[#064E3B]/15 bg-gradient-to-r from-[#b0f0d6]/20 via-white to-[#FEF3C7]/35 p-6 dark:border-[#80bea6]/20 dark:from-[#064E3B]/30 dark:via-[#131b2e] dark:to-[#004d47]/25">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#064E3B] dark:text-[#b0f0d6]" />
            <h2 className="text-base font-semibold text-[#131b2e] dark:text-white">
              {t('dash.portfolioPulseTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setActiveView('accounts')}
            className="text-xs font-semibold text-[#0F766E] hover:underline dark:text-[#6ac0b6]"
          >
            {t('dash.openPortfolio')}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div className="text-[11px] text-[#404944] dark:text-[#bfc9c3]">{t('inv.portfolioValue')}</div>
            <div className="font-numeric text-lg font-bold text-[#131b2e] dark:text-white">
              {formatMoney(portfolio.totalCurrentValue, baseCurrency, privacyMode)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#404944] dark:text-[#bfc9c3]">{t('inv.unrealizedGain')}</div>
            <div
              className={`font-numeric text-lg font-bold ${
                portfolio.totalGain >= 0
                  ? 'text-[#10B981]'
                  : 'text-[#ba1a1a]'
              }`}
            >
              {portfolio.totalGain >= 0 ? '+' : ''}
              {formatMoney(portfolio.totalGain, baseCurrency, privacyMode)} ({portfolio.totalGainPct}
              %)
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#404944] dark:text-[#bfc9c3]">{t('inv.monthlySip')}</div>
            <div className="font-numeric text-lg font-bold text-[#0F766E] dark:text-[#6ac0b6]">
              {formatMoney(portfolio.activeMonthlySip, baseCurrency, privacyMode)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#404944] dark:text-[#bfc9c3]">{t('dash.proj10YrShort')}</div>
            <div className="font-numeric text-lg font-bold text-[#064E3B] dark:text-[#b0f0d6]">
              {formatMoney(proj10Yr.finalValue, baseCurrency, privacyMode)}
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Bills & Recent Transactions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="wdw-card p-6 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-[#D97706]" />
              <h2 className="text-base font-semibold text-[#131b2e] dark:text-white">
                {t('dash.upcomingBills')}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveView('bills')}
              className="text-xs font-semibold text-[#0F766E] hover:underline dark:text-[#6ac0b6]"
            >
              {t('dash.viewAll')}
            </button>
          </div>

          <div className="divide-y divide-[#F1F5F9] dark:divide-[#232f4f]">
            {upcomingBills.map((bill) => {
              const isOverdue = bill.nextDueDate < today;
              return (
                <div
                  key={bill.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-[#131b2e] dark:text-white">
                      {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-[#D97706]" />}
                      <span>{entityText(bill.title)}</span>
                    </div>
                    <div className="font-numeric text-xs text-[#404944] dark:text-[#bfc9c3]">
                      {t('dash.dueLine', {
                        date: bill.nextDueDate,
                        freq: freqLabel(bill.frequency),
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-numeric text-sm font-semibold ${
                        bill.type === 'income'
                          ? 'text-[#10B981]'
                          : 'text-[#131b2e] dark:text-white'
                      }`}
                    >
                      {bill.type === 'income' ? '+' : ''}
                      {formatMoney(bill.amount, bill.currency, privacyMode)}
                    </span>
                    <button
                      type="button"
                      onClick={() => postRecurringDue(bill.id)}
                      className="wdw-btn-secondary px-2.5 py-1 text-xs font-semibold"
                    >
                      {t('dash.post')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="wdw-card p-6 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#131b2e] dark:text-white">
              {t('dash.recentActivity', { month: formatMonth(selectedMonth) })}
            </h2>
            <button
              type="button"
              onClick={() => setActiveView('transactions')}
              className="text-xs font-semibold text-[#0F766E] hover:underline dark:text-[#6ac0b6]"
            >
              {t('dash.fullLedger')}
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#404944] dark:text-[#bfc9c3]">{t('dash.noTxMonth')}</p>
          ) : (
            <div className="divide-y divide-[#F1F5F9] dark:divide-[#232f4f]">
              {recentTransactions.map((tx) => {
                const cat = state.categories.find((c) => c.id === tx.categoryId);
                const member = state.members.find((m) => m.id === tx.memberId);
                const account = state.accounts.find((a) => a.id === tx.accountId);
                return (
                  <div
                    key={tx.id}
                    onClick={() => openQuickAdd(tx)}
                    className="flex cursor-pointer items-center justify-between rounded-lg px-1 py-3 transition hover:bg-[#f2f3ff]/70 dark:hover:bg-[#1c2640]/50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base ${
                          tx.type === 'income'
                            ? 'bg-[#064E3B]/10 dark:bg-[#064E3B]/40'
                            : 'bg-[#FEF3C7] dark:bg-[#904d00]/35'
                        }`}
                      >
                        {cat?.icon ?? '💳'}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[#131b2e] dark:text-white">
                          {entityText(tx.merchant)}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#404944] dark:text-[#bfc9c3]">
                          <span className="font-numeric">{tx.date}</span>
                          <span>•</span>
                          <span className="rounded-full bg-[#064E3B]/8 px-2 py-0.5 text-[11px] font-medium text-[#064E3B] dark:bg-[#064E3B]/40 dark:text-[#b0f0d6]">
                            {cat ? catName(cat) : t('tx.transfer')}
                          </span>
                          <span>•</span>
                          <span>{accName(account)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="ml-3 flex shrink-0 flex-col items-end gap-0.5">
                      <div
                        className={`font-numeric whitespace-nowrap text-sm font-semibold ${
                          tx.type === 'income'
                            ? 'text-[#10B981]'
                            : tx.type === 'transfer'
                            ? 'text-[#0F766E] dark:text-[#6ac0b6]'
                            : 'text-[#131b2e] dark:text-white'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '⇄ '}
                        {formatMoney(tx.amount, tx.currency, privacyMode)}
                      </div>
                      {member && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#404944] dark:text-[#bfc9c3]">
                          <MemberRoleAvatar
                            avatar={member.avatar}
                            role={member.role}
                            name={memName(member)}
                            size="xs"
                          />
                          <span>{memName(member)}</span>
                        </span>
                      )}
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
