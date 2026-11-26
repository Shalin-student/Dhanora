import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Gauge, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import type { BudgetBucket, Category } from '../types/finance';
import {
  compute503020Breakdown,
  computeCategorySpending,
} from '../utils/calculations';
import {
  computeBudgetPace,
  computeCategoryEnvelopesWithRollover,
  computeZeroBasedSummary,
} from '../utils/forecast';
import { formatMoney } from '../utils/currency';
import { useI18n } from '../i18n/useI18n';

export const BudgetsView: React.FC = () => {
  const { state, selectedMonth, selectedMemberId, upsertCategory, deleteCategory } = useFinance();
  const { baseCurrency, privacyMode } = state.settings;
  const { t, formatMonth, catName, bucketLabel } = useI18n();

  const [plannerMode, setPlannerMode] = useState<'50-30-20' | 'zero-based'>('50-30-20');
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('📦');
  const [newType, setNewType] = useState<'expense' | 'income'>('expense');
  const [newBucket, setNewBucket] = useState<BudgetBucket>('wants');
  const [newBudget, setNewBudget] = useState('300');
  const [newRollover, setNewRollover] = useState(false);

  const envelopeList = computeCategoryEnvelopesWithRollover(
    state.transactions,
    state.categories,
    selectedMonth,
    selectedMemberId
  );
  const incomeList = computeCategorySpending(
    state.transactions,
    state.categories,
    selectedMonth,
    'income',
    selectedMemberId
  );
  const rule503020 = compute503020Breakdown(
    state.transactions,
    state.categories,
    selectedMonth,
    selectedMemberId
  );
  const zeroBased = computeZeroBasedSummary(state, selectedMonth, selectedMemberId);

  const totalBaseBudgeted = envelopeList.reduce((s, item) => s + item.baseBudget, 0);
  const totalAvailableBudget = envelopeList.reduce((s, item) => s + item.availableBudget, 0);
  const totalSpent = envelopeList.reduce((s, item) => s + item.spent, 0);
  const overallPct =
    totalAvailableBudget > 0 ? Math.round((totalSpent / totalAvailableBudget) * 100) : 0;
  const pace = computeBudgetPace(selectedMonth, totalAvailableBudget, totalSpent);

  const handleBudgetUpdate = (cat: Category, nextLimit: number) => {
    upsertCategory({
      ...cat,
      budgetLimit: Math.max(0, nextLimit),
    });
  };

  const handleToggleRollover = (cat: Category) => {
    upsertCategory({
      ...cat,
      rollover: !cat.rollover,
    });
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    upsertCategory({
      id: `cat-${Date.now()}`,
      name: newName.trim(),
      type: newType,
      icon: newIcon || '🏷️',
      color: newType === 'income' ? '#10b981' : '#3b82f6',
      bucket: newType === 'expense' ? newBucket : undefined,
      budgetLimit: newType === 'expense' ? parseFloat(newBudget) || 0 : undefined,
      rollover: newType === 'expense' ? newRollover : false,
    });
    setNewName('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#131b2e] sm:text-[32px] sm:leading-[40px] dark:text-white">
            {t('bgt.title')}
          </h1>
          <p className="text-sm text-[#404944] dark:text-[#bfc9c3]">
            {t('bgt.subtitle', { month: formatMonth(selectedMonth) })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-[#bfc9c3]/70 bg-white p-1 dark:border-[#2f3b52] dark:bg-[#131b2e]">
            <button
              type="button"
              onClick={() => setPlannerMode('50-30-20')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                plannerMode === '50-30-20'
                  ? 'bg-[#064E3B] text-white'
                  : 'text-[#404944] hover:text-[#131b2e] dark:text-[#bfc9c3]'
              }`}
            >
              {t('bgt.mode503020')}
            </button>
            <button
              type="button"
              onClick={() => setPlannerMode('zero-based')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                plannerMode === 'zero-based'
                  ? 'bg-[#064E3B] text-white'
                  : 'text-[#404944] hover:text-[#131b2e] dark:text-[#bfc9c3]'
              }`}
            >
              {t('bgt.modeZeroBased')}
            </button>
          </div>

          <div className="wdw-card px-4 py-2.5 text-right">
            <div className="label-caps text-[#404944] dark:text-[#bfc9c3]">
              {t('bgt.totalUsedLabel')}
            </div>
            <div className="font-numeric text-base font-bold text-[#131b2e] dark:text-white">
              {formatMoney(totalSpent, baseCurrency, privacyMode)} /{' '}
              {formatMoney(totalAvailableBudget, baseCurrency, privacyMode)}{' '}
              <span
                className={`ml-1 text-xs ${
                  overallPct > 100 ? 'text-[#ba1a1a]' : overallPct > 85 ? 'text-[#D97706]' : 'text-[#10B981]'
                }`}
              >
                ({overallPct}%)
              </span>
            </div>
            {totalAvailableBudget !== totalBaseBudgeted && (
              <div className="font-numeric text-[10px] font-semibold text-[#0F766E] dark:text-[#6ac0b6]">
                {t('bgt.includesRollover', {
                  amt: `${totalAvailableBudget - totalBaseBudgeted >= 0 ? '+' : ''}${formatMoney(
                    totalAvailableBudget - totalBaseBudgeted,
                    baseCurrency,
                    privacyMode
                  )}`,
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Month Pace & Daily Safe-to-Spend */}
      <div className="wdw-card grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#064E3B]/10 text-[#064E3B] dark:bg-[#064E3B]/50 dark:text-[#b0f0d6]">
            <Gauge className="h-5 w-5" />
          </span>
          <div>
            <div className="label-caps text-[#404944] dark:text-[#bfc9c3]">
              {t('bgt.monthElapsed')}
            </div>
            <div className="font-numeric text-sm font-bold text-[#131b2e] dark:text-white">
              {t('bgt.dayOfMonth', {
                elapsed: pace.elapsedDays,
                total: pace.daysInMonth,
                pct: pace.monthElapsedPct,
              })}
            </div>
          </div>
        </div>

        <div>
          <div className="label-caps text-[#404944] dark:text-[#bfc9c3]">
            {t('bgt.spendingPace')}
          </div>
          <div
            className={`font-numeric text-sm font-bold ${
              pace.paceDelta >= 0
                ? 'text-[#10B981]'
                : 'text-[#D97706]'
            }`}
          >
            {pace.paceDelta >= 0
              ? t('bgt.underPace', { amt: formatMoney(pace.paceDelta, baseCurrency, privacyMode) })
              : t('bgt.overPace', {
                  amt: formatMoney(Math.abs(pace.paceDelta), baseCurrency, privacyMode),
                })}
          </div>
          <div className="font-numeric text-[11px] text-[#404944] dark:text-[#bfc9c3]">
            {t('bgt.spentVsElapsed', {
              used: pace.budgetUsedPct,
              elapsed: pace.monthElapsedPct,
            })}
          </div>
        </div>

        <div>
          <div className="label-caps text-[#404944] dark:text-[#bfc9c3]">
            {t('bgt.dailySafe')}
          </div>
          <div className="font-numeric text-sm font-bold text-[#0F766E] dark:text-[#6ac0b6]">
            {t('bgt.perDay', { amt: formatMoney(pace.dailySafeToSpend, baseCurrency, privacyMode) })}
          </div>
          <div className="font-numeric text-[11px] text-[#404944] dark:text-[#bfc9c3]">
            {t('bgt.daysRemaining', { days: pace.remainingDays })}
          </div>
        </div>
      </div>

      {/* 50/30/20 Overview OR Zero-Based Allocation */}
      {plannerMode === '50-30-20' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              title: t('bgt.needsBox'),
              pct: rule503020.needsPct,
              amount: rule503020.needs,
              desc: t('bgt.needsDesc'),
              tone: 'border-[#064E3B]/20 bg-[#b0f0d6]/20 dark:border-[#064E3B] dark:bg-[#064E3B]/25',
            },
            {
              title: t('bgt.wantsBox'),
              pct: rule503020.wantsPct,
              amount: rule503020.wants,
              desc: t('bgt.wantsDesc'),
              tone: 'border-[#FCD34D] bg-[#FEF3C7]/60 dark:border-[#904d00] dark:bg-[#904d00]/25',
            },
            {
              title: t('bgt.savingsBox'),
              pct: rule503020.savingsPct,
              amount: rule503020.savings,
              desc: t('bgt.savingsDesc'),
              tone: 'border-[#10B981]/30 bg-[#9cf2e8]/25 dark:border-[#0F766E] dark:bg-[#004d47]/25',
            },
          ].map((box) => (
            <div key={box.title} className={`rounded-2xl border p-5 ${box.tone}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#131b2e] dark:text-[#eef0ff]">
                  {box.title}
                </span>
                <span className="font-numeric text-lg font-bold text-[#131b2e] dark:text-white">
                  {box.pct}%
                </span>
              </div>
              <div className="font-numeric mt-1 text-sm font-bold text-[#064E3B] dark:text-[#b0f0d6]">
                {formatMoney(box.amount, baseCurrency, privacyMode)}
              </div>
              <p className="mt-1 text-xs text-[#404944] dark:text-[#bfc9c3]">{box.desc}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="wdw-card p-5">
            <div className="label-caps text-[#404944] dark:text-[#bfc9c3]">{t('bgt.zbIncome')}</div>
            <div className="font-numeric mt-1 text-xl font-bold text-[#10B981]">
              {formatMoney(zeroBased.monthlyIncome, baseCurrency, privacyMode)}
            </div>
            <p className="mt-1 text-xs text-[#404944] dark:text-[#bfc9c3]">{t('bgt.zbIncomeDesc')}</p>
          </div>
          <div className="wdw-card p-5">
            <div className="label-caps text-[#404944] dark:text-[#bfc9c3]">{t('bgt.zbAssigned')}</div>
            <div className="font-numeric mt-1 text-xl font-bold text-[#0F766E] dark:text-[#6ac0b6]">
              {formatMoney(zeroBased.totalAssigned, baseCurrency, privacyMode)} ({zeroBased.assignedPct}%)
            </div>
            <p className="mt-1 text-xs text-[#404944] dark:text-[#bfc9c3]">{t('bgt.zbAssignedDesc')}</p>
          </div>
          <div
            className={`rounded-2xl border p-5 ${
              zeroBased.unassigned === 0
                ? 'border-[#10B981]/35 bg-[#b0f0d6]/25 dark:border-[#0F766E] dark:bg-[#064E3B]/30'
                : zeroBased.unassigned > 0
                ? 'border-[#FCD34D] bg-[#FEF3C7]/60 dark:border-[#904d00] dark:bg-[#904d00]/25'
                : 'border-[#ba1a1a]/30 bg-[#ffdad6]/60'
            }`}
          >
            <div className="label-caps text-[#404944] dark:text-[#bfc9c3]">
              {zeroBased.unassigned >= 0 ? t('bgt.leftToAssign') : t('bgt.overAssigned')}
            </div>
            <div className="font-numeric mt-1 text-xl font-bold text-[#131b2e] dark:text-white">
              {formatMoney(Math.abs(zeroBased.unassigned), baseCurrency, privacyMode)}
            </div>
            <p className="mt-1 text-xs text-[#404944] dark:text-[#bfc9c3]">
              {zeroBased.unassigned === 0
                ? t('bgt.zbZero')
                : zeroBased.unassigned > 0
                ? t('bgt.zbPositive')
                : t('bgt.zbNegative')}
            </p>
          </div>
        </div>
      )}

      {/* Expense Budgets Grid */}
      <div className="wdw-card p-6">
        <h2 className="mb-4 text-base font-semibold text-[#131b2e] dark:text-white">
          {t('bgt.envelopesTitle')}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {envelopeList.map(
            ({ category, baseBudget, rolloverAmount, availableBudget, spent, remaining, percentage }) => {
              const over = availableBudget > 0 && spent > availableBudget;
              const warn = availableBudget > 0 && !over && percentage >= 80;
              const label = catName(category);

              return (
                <div
                  key={category.id}
                  className="rounded-xl border border-[#F1F5F9] bg-[#faf8ff]/50 p-4 dark:border-[#232f4f] dark:bg-[#172036]/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FEF3C7] text-lg dark:bg-[#904d00]/35">
                        {category.icon}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-[#131b2e] dark:text-white">
                          <span>{label}</span>
                          {over ? (
                            <AlertCircle className="h-4 w-4 text-[#ba1a1a]" />
                          ) : (
                            <CheckCircle className="h-3.5 w-3.5 text-[#10B981]" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[#404944] dark:text-[#bfc9c3]">
                          <span className="uppercase">{bucketLabel(category.bucket ?? 'wants')}</span>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => handleToggleRollover(category)}
                            className={`inline-flex items-center gap-1 font-medium ${
                              category.rollover ? 'text-[#0F766E] dark:text-[#6ac0b6]' : ''
                            }`}
                          >
                            <RefreshCw className="h-3 w-3" />
                            {category.rollover ? t('bgt.rolloverOn') : t('bgt.rolloverOff')}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-[#404944] dark:text-[#bfc9c3]">{t('bgt.limitLabel')}</label>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={baseBudget}
                        onChange={(e) =>
                          handleBudgetUpdate(category, parseFloat(e.target.value) || 0)
                        }
                        aria-label={t('bgt.limitAria', { name: category.name })}
                        className="font-numeric w-24 rounded-lg border border-[#CBD5E1] bg-white px-2 py-1 text-right text-xs font-bold text-[#131b2e] dark:border-[#2f3b52] dark:bg-[#131b2e] dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => deleteCategory(category.id)}
                        className="rounded p-1 text-[#707974] hover:text-[#ba1a1a]"
                        aria-label={t('bgt.deleteAria', { name: category.name })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {category.rollover && rolloverAmount !== 0 && (
                    <div className="font-numeric mt-2 flex items-center justify-between rounded-lg bg-[#9cf2e8]/30 px-2.5 py-1 text-[11px] font-semibold text-[#003430] dark:bg-[#004d47]/40 dark:text-[#9cf2e8]">
                      <span>
                        {t('bgt.rolloverAmt', {
                          amt: `${rolloverAmount >= 0 ? '+' : ''}${formatMoney(
                            rolloverAmount,
                            baseCurrency,
                            privacyMode
                          )}`,
                        })}
                      </span>
                      <span>
                        {t('bgt.availableAmt', {
                          amt: formatMoney(availableBudget, baseCurrency, privacyMode),
                        })}
                      </span>
                    </div>
                  )}

                  <div className="mt-3">
                    <div className="font-numeric mb-1 flex justify-between text-xs">
                      <span className="font-semibold text-[#131b2e] dark:text-[#eef0ff]">
                        {t('bgt.spentAmt', { amt: formatMoney(spent, baseCurrency, privacyMode) })}
                      </span>
                      <span
                        className={`font-semibold ${
                          over
                            ? 'text-[#ba1a1a]'
                            : warn
                            ? 'text-[#D97706]'
                            : 'text-[#10B981]'
                        }`}
                      >
                        {remaining >= 0
                          ? t('bgt.leftAmt', { amt: formatMoney(remaining, baseCurrency, privacyMode) })
                          : t('bgt.overAmt', {
                              amt: formatMoney(Math.abs(remaining), baseCurrency, privacyMode),
                            })}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#eaedff] dark:bg-[#1c2640]">
                      <div
                        className={`h-full rounded-full transition-all ${
                          over ? 'bg-[#ba1a1a]' : warn ? 'bg-[#D97706]' : 'bg-[#10B981]'
                        }`}
                        style={{ width: `${Math.min(100, percentage)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* Income Streams + Add Category */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="wdw-card p-6">
          <h2 className="mb-4 text-base font-semibold text-[#131b2e] dark:text-white">
            {t('bgt.incomeStreams', { month: formatMonth(selectedMonth) })}
          </h2>
          <div className="space-y-2.5">
            {incomeList.map(({ category, spent }) => (
              <div
                key={category.id}
                className="wdw-surface-tier flex items-center justify-between rounded-xl px-3.5 py-2.5"
              >
                <span className="text-sm font-semibold">
                  {category.icon} {catName(category)}
                </span>
                <span className="font-numeric text-sm font-bold text-[#10B981]">
                  +{formatMoney(spent, baseCurrency, privacyMode)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <form
          onSubmit={handleAddCategory}
          className="wdw-card p-6"
        >
          <h2 className="mb-4 text-base font-semibold text-[#131b2e] dark:text-white">
            {t('bgt.createCat')}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#404944] dark:text-[#bfc9c3]">
                {t('bgt.catName')}
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('bgt.catNamePlaceholder')}
                className="min-h-[40px] w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#404944] dark:text-[#bfc9c3]">
                  {t('bgt.icon')}
                </label>
                <input
                  type="text"
                  value={newIcon}
                  onChange={(e) => setNewIcon(e.target.value)}
                  className="min-h-[40px] w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-center text-sm dark:border-[#2f3b52] dark:bg-[#172036]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#404944] dark:text-[#bfc9c3]">
                  {t('bgt.type')}
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as 'expense' | 'income')}
                  className="min-h-[40px] w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-2 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
                >
                  <option value="expense">{t('tx.expense')}</option>
                  <option value="income">{t('tx.income')}</option>
                </select>
              </div>
            </div>

            {newType === 'expense' && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#404944] dark:text-[#bfc9c3]">
                    {t('bgt.group503020')}
                  </label>
                  <select
                    value={newBucket}
                    onChange={(e) => setNewBucket(e.target.value as BudgetBucket)}
                    className="min-h-[40px] w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
                  >
                    <option value="needs">{bucketLabel('needs')}</option>
                    <option value="wants">{bucketLabel('wants')}</option>
                    <option value="savings">{bucketLabel('savings')}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#404944] dark:text-[#bfc9c3]">
                    {t('bgt.monthlyLimit')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newBudget}
                    onChange={(e) => setNewBudget(e.target.value)}
                    className="font-numeric min-h-[40px] w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs font-medium sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={newRollover}
                    onChange={(e) => setNewRollover(e.target.checked)}
                    className="accent-[#064E3B]"
                  />
                  {t('bgt.enableRollover')}
                </label>
              </>
            )}
          </div>

          <button
            type="submit"
            className="wdw-btn-primary mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold"
          >
            <Plus className="h-4 w-4" />
            {t('bgt.addCategory')}
          </button>
        </form>
      </div>
    </div>
  );
};
