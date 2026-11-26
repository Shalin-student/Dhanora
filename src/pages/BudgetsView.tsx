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
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {t('bgt.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('bgt.subtitle', { month: formatMonth(selectedMonth) })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setPlannerMode('50-30-20')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                plannerMode === '50-30-20'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
              }`}
            >
              {t('bgt.mode503020')}
            </button>
            <button
              type="button"
              onClick={() => setPlannerMode('zero-based')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                plannerMode === 'zero-based'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
              }`}
            >
              {t('bgt.modeZeroBased')}
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-right dark:border-slate-800 dark:bg-slate-900">
            <div className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">
              {t('bgt.totalUsedLabel')}
            </div>
            <div className="text-base font-extrabold text-slate-900 dark:text-white">
              {formatMoney(totalSpent, baseCurrency, privacyMode)} /{' '}
              {formatMoney(totalAvailableBudget, baseCurrency, privacyMode)}{' '}
              <span
                className={`ml-1 text-xs ${
                  overallPct > 100 ? 'text-rose-600' : overallPct > 85 ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                ({overallPct}%)
              </span>
            </div>
            {totalAvailableBudget !== totalBaseBudgeted && (
              <div className="text-[10px] text-blue-600 dark:text-blue-400">
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
      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
            <Gauge className="h-5 w-5" />
          </span>
          <div>
            <div className="text-[11px] font-semibold uppercase text-slate-500">
              {t('bgt.monthElapsed')}
            </div>
            <div className="text-sm font-extrabold text-slate-900 dark:text-white">
              {t('bgt.dayOfMonth', {
                elapsed: pace.elapsedDays,
                total: pace.daysInMonth,
                pct: pace.monthElapsedPct,
              })}
            </div>
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase text-slate-500">
            {t('bgt.spendingPace')}
          </div>
          <div
            className={`text-sm font-extrabold ${
              pace.paceDelta >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {pace.paceDelta >= 0
              ? t('bgt.underPace', { amt: formatMoney(pace.paceDelta, baseCurrency, privacyMode) })
              : t('bgt.overPace', {
                  amt: formatMoney(Math.abs(pace.paceDelta), baseCurrency, privacyMode),
                })}
          </div>
          <div className="text-[11px] text-slate-500">
            {t('bgt.spentVsElapsed', {
              used: pace.budgetUsedPct,
              elapsed: pace.monthElapsedPct,
            })}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase text-slate-500">
            {t('bgt.dailySafe')}
          </div>
          <div className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
            {t('bgt.perDay', { amt: formatMoney(pace.dailySafeToSpend, baseCurrency, privacyMode) })}
          </div>
          <div className="text-[11px] text-slate-500">
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
              tone: 'border-blue-200 bg-blue-50/40 dark:border-blue-900/60 dark:bg-blue-950/20',
            },
            {
              title: t('bgt.wantsBox'),
              pct: rule503020.wantsPct,
              amount: rule503020.wants,
              desc: t('bgt.wantsDesc'),
              tone: 'border-amber-200 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20',
            },
            {
              title: t('bgt.savingsBox'),
              pct: rule503020.savingsPct,
              amount: rule503020.savings,
              desc: t('bgt.savingsDesc'),
              tone: 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/20',
            },
          ].map((box) => (
            <div key={box.title} className={`rounded-2xl border p-4 ${box.tone}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {box.title}
                </span>
                <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {box.pct}%
                </span>
              </div>
              <div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">
                {formatMoney(box.amount, baseCurrency, privacyMode)}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{box.desc}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs font-bold text-slate-500">{t('bgt.zbIncome')}</div>
            <div className="mt-1 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {formatMoney(zeroBased.monthlyIncome, baseCurrency, privacyMode)}
            </div>
            <p className="mt-1 text-xs text-slate-500">{t('bgt.zbIncomeDesc')}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs font-bold text-slate-500">{t('bgt.zbAssigned')}</div>
            <div className="mt-1 text-xl font-extrabold text-blue-600 dark:text-blue-400">
              {formatMoney(zeroBased.totalAssigned, baseCurrency, privacyMode)} ({zeroBased.assignedPct}%)
            </div>
            <p className="mt-1 text-xs text-slate-500">{t('bgt.zbAssignedDesc')}</p>
          </div>
          <div
            className={`rounded-2xl border p-4 ${
              zeroBased.unassigned === 0
                ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30'
                : zeroBased.unassigned > 0
                ? 'border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30'
                : 'border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/30'
            }`}
          >
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
              {zeroBased.unassigned >= 0 ? t('bgt.leftToAssign') : t('bgt.overAssigned')}
            </div>
            <div className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">
              {formatMoney(Math.abs(zeroBased.unassigned), baseCurrency, privacyMode)}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">
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
                  className="rounded-xl border border-slate-100 p-4 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-lg dark:bg-slate-800">
                        {category.icon}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                          <span>{label}</span>
                          {over ? (
                            <AlertCircle className="h-4 w-4 text-rose-500" />
                          ) : (
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="uppercase">{bucketLabel(category.bucket ?? 'wants')}</span>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => handleToggleRollover(category)}
                            className={`inline-flex items-center gap-1 font-medium ${
                              category.rollover ? 'text-blue-600 dark:text-blue-400' : ''
                            }`}
                          >
                            <RefreshCw className="h-3 w-3" />
                            {category.rollover ? t('bgt.rolloverOn') : t('bgt.rolloverOff')}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-slate-500">{t('bgt.limitLabel')}</label>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={baseBudget}
                        onChange={(e) =>
                          handleBudgetUpdate(category, parseFloat(e.target.value) || 0)
                        }
                        aria-label={t('bgt.limitAria', { name: category.name })}
                        className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-right text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => deleteCategory(category.id)}
                        className="rounded p-1 text-slate-400 hover:text-rose-500"
                        aria-label={t('bgt.deleteAria', { name: category.name })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {category.rollover && rolloverAmount !== 0 && (
                    <div className="mt-2 flex items-center justify-between rounded-lg bg-blue-50/70 px-2.5 py-1 text-[11px] font-semibold text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
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
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {t('bgt.spentAmt', { amt: formatMoney(spent, baseCurrency, privacyMode) })}
                      </span>
                      <span
                        className={`font-semibold ${
                          over
                            ? 'text-rose-600 dark:text-rose-400'
                            : warn
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {remaining >= 0
                          ? t('bgt.leftAmt', { amt: formatMoney(remaining, baseCurrency, privacyMode) })
                          : t('bgt.overAmt', {
                              amt: formatMoney(Math.abs(remaining), baseCurrency, privacyMode),
                            })}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all ${
                          over ? 'bg-rose-500' : warn ? 'bg-amber-500' : 'bg-emerald-500'
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">
            {t('bgt.incomeStreams', { month: formatMonth(selectedMonth) })}
          </h2>
          <div className="space-y-2.5">
            {incomeList.map(({ category, spent }) => (
              <div
                key={category.id}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 dark:bg-slate-800/60"
              >
                <span className="text-sm font-semibold">
                  {category.icon} {catName(category)}
                </span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  +{formatMoney(spent, baseCurrency, privacyMode)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <form
          onSubmit={handleAddCategory}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">
            {t('bgt.createCat')}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                {t('bgt.catName')}
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('bgt.catNamePlaceholder')}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t('bgt.icon')}
                </label>
                <input
                  type="text"
                  value={newIcon}
                  onChange={(e) => setNewIcon(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t('bgt.type')}
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as 'expense' | 'income')}
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="expense">{t('tx.expense')}</option>
                  <option value="income">{t('tx.income')}</option>
                </select>
              </div>
            </div>

            {newType === 'expense' && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {t('bgt.group503020')}
                  </label>
                  <select
                    value={newBucket}
                    onChange={(e) => setNewBucket(e.target.value as BudgetBucket)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="needs">{bucketLabel('needs')}</option>
                    <option value="wants">{bucketLabel('wants')}</option>
                    <option value="savings">{bucketLabel('savings')}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {t('bgt.monthlyLimit')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newBudget}
                    onChange={(e) => setNewBudget(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs font-medium sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={newRollover}
                    onChange={(e) => setNewRollover(e.target.checked)}
                  />
                  {t('bgt.enableRollover')}
                </label>
              </>
            )}
          </div>

          <button
            type="submit"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            {t('bgt.addCategory')}
          </button>
        </form>
      </div>
    </div>
  );
};
