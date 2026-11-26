import React from 'react';
import { Calendar, Download, Printer } from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import {
  computeCategorySpending,
  computeMonthlySummary,
  shiftMonth,
} from '../utils/calculations';
import { formatMoney } from '../utils/currency';
import { exportTransactionsToCsv } from '../utils/csv';
import { computeNetWorthHistory } from '../utils/wealth';
import { NetWorthHistoryChart } from '../components/Charts';
import { useI18n } from '../i18n/useI18n';

export const ReportsView: React.FC = () => {
  const { state, selectedMonth, selectedMemberId } = useFinance();
  const { baseCurrency, privacyMode } = state.settings;
  const { language, t, formatMonth, catName } = useI18n();
  const netWorthHistory = computeNetWorthHistory(state, selectedMonth, 6, language);

  const summary = computeMonthlySummary(state.transactions, selectedMonth, selectedMemberId);
  const expCategories = computeCategorySpending(
    state.transactions,
    state.categories,
    selectedMonth,
    'expense',
    selectedMemberId
  );
  const incCategories = computeCategorySpending(
    state.transactions,
    state.categories,
    selectedMonth,
    'income',
    selectedMemberId
  );

  // Build daily spend map for selectedMonth heatmap
  const [yr, mo] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(yr, mo, 0).getDate();
  const dailySpend = new Map<number, number>();
  for (const tx of state.transactions) {
    if (!tx.date.startsWith(selectedMonth) || tx.type !== 'expense') continue;
    if (selectedMemberId !== 'all' && tx.memberId !== selectedMemberId) continue;
    const day = Number(tx.date.slice(8, 10));
    dailySpend.set(day, (dailySpend.get(day) ?? 0) + tx.baseAmount);
  }
  const maxDaySpend = Math.max(...Array.from(dailySpend.values()), 1);

  // Tag breakdown
  const tagTotals = new Map<string, number>();
  for (const tx of state.transactions) {
    if (!tx.date.startsWith(selectedMonth) || tx.type !== 'expense') continue;
    if (selectedMemberId !== 'all' && tx.memberId !== selectedMemberId) continue;
    for (const tag of tx.tags) {
      tagTotals.set(tag, (tagTotals.get(tag) ?? 0) + tx.baseAmount);
    }
  }
  const topTags = Array.from(tagTotals.entries()).sort((a, b) => b[1] - a[1]);

  // 6-month summary table
  const annualRows = Array.from({ length: 6 }, (_, i) => {
    const mKey = shiftMonth(selectedMonth, i - 5);
    return computeMonthlySummary(state.transactions, mKey, selectedMemberId);
  });

  const handleDownloadMonthlyCsv = () => {
    const monthTxs = state.transactions.filter((tx) => tx.date.startsWith(selectedMonth));
    const csv = exportTransactionsToCsv(
      monthTxs,
      state.categories,
      state.accounts,
      state.members,
      language
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `family-statement-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {t('rep.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('rep.subtitle', { month: formatMonth(selectedMonth) })}
          </p>
        </div>

        <div className="no-print flex gap-2">
          <button
            type="button"
            onClick={handleDownloadMonthlyCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Download className="h-4 w-4" />
            {t('tx.exportCsv')}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Printer className="h-4 w-4" />
            {t('rep.printStatement')}
          </button>
        </div>
      </div>

      {/* Daily Spend Heatmap */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t('rep.heatmapTitle', { month: formatMonth(selectedMonth) })}
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            {t('rep.heatmapSub')}
          </span>
        </div>

        <div className="grid grid-cols-7 gap-2 sm:grid-cols-10">
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const val = dailySpend.get(day) ?? 0;
            const intensity = val / maxDaySpend;
            const bgClass =
              val === 0
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                : intensity > 0.65
                ? 'bg-rose-500 text-white'
                : intensity > 0.3
                ? 'bg-amber-400 text-slate-950'
                : 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200';

            return (
              <div
                key={day}
                className={`rounded-xl p-2 text-center ${bgClass}`}
                title={t('rep.dayTitle', {
                  day,
                  amt: formatMoney(val, baseCurrency, privacyMode),
                })}
              >
                <div className="text-[10px] font-bold opacity-80">{t('rep.dayN', { day })}</div>
                <div className="mt-0.5 truncate text-[11px] font-extrabold">
                  {val === 0
                    ? formatMoney(0, baseCurrency, privacyMode, true)
                    : formatMoney(val, baseCurrency, privacyMode, true)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Statement Summary + Tag Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">
            {t('rep.breakdownTitle')}
          </h2>
          <div className="mb-4 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/60">
            <div>
              <div className="text-[11px] text-slate-500">{t('rep.totalIncome')}</div>
              <div className="text-sm font-bold text-emerald-600">
                {formatMoney(summary.income, baseCurrency, privacyMode)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">{t('rep.totalSpend')}</div>
              <div className="text-sm font-bold text-rose-600">
                {formatMoney(summary.expense, baseCurrency, privacyMode)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">{t('rep.saved')}</div>
              <div className="text-sm font-bold text-blue-600">
                {formatMoney(summary.netSavings, baseCurrency, privacyMode)} ({summary.savingsRate}%)
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase text-slate-400">
              {t('rep.incomeSources')}
            </h3>
            {incCategories
              .filter((c) => c.spent > 0)
              .map((c) => (
                <div key={c.category.id} className="flex justify-between text-xs">
                  <span>
                    {c.category.icon} {catName(c.category)}
                  </span>
                  <span className="font-bold text-emerald-600">
                    +{formatMoney(c.spent, baseCurrency, privacyMode)}
                  </span>
                </div>
              ))}

            <h3 className="pt-3 text-xs font-bold uppercase text-slate-400">
              {t('rep.expenseCategories')}
            </h3>
            {expCategories
              .filter((c) => c.spent > 0)
              .map((c) => (
                <div key={c.category.id} className="flex justify-between text-xs">
                  <span>
                    {c.category.icon} {catName(c.category)}
                  </span>
                  <span className="font-bold">
                    {formatMoney(c.spent, baseCurrency, privacyMode)}
                  </span>
                </div>
              ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-base font-bold text-slate-900 dark:text-white">
              {t('rep.tagTitle')}
            </h2>
            {topTags.length === 0 ? (
              <p className="text-xs text-slate-500">{t('rep.noTags')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {topTags.map(([tag, amt]) => (
                  <div
                    key={tag}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    <span className="font-semibold text-blue-600 dark:text-blue-400">#{tag}</span>{' '}
                    <span className="font-bold">
                      {formatMoney(amt, baseCurrency, privacyMode)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-base font-bold text-slate-900 dark:text-white">
              {t('rep.ledger6MoTitle')}
            </h2>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-[11px] text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="py-2">{t('rep.thMonth')}</th>
                  <th className="py-2 text-right">{t('rep.thIncome')}</th>
                  <th className="py-2 text-right">{t('rep.thExpense')}</th>
                  <th className="py-2 text-right">{t('rep.thNet')}</th>
                  <th className="py-2 text-right">{t('rep.thRate')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {annualRows.map((row) => (
                  <tr key={row.month}>
                    <td className="py-2 font-semibold">{formatMonth(row.month)}</td>
                    <td className="py-2 text-right text-emerald-600">
                      {formatMoney(row.income, baseCurrency, privacyMode)}
                    </td>
                    <td className="py-2 text-right text-rose-600">
                      {formatMoney(row.expense, baseCurrency, privacyMode)}
                    </td>
                    <td className="py-2 text-right font-bold">
                      {formatMoney(row.netSavings, baseCurrency, privacyMode)}
                    </td>
                    <td className="py-2 text-right text-slate-500">{row.savingsRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-base font-bold text-slate-900 dark:text-white">
              {t('rep.netWorth6MoTitle')}
            </h2>
            <NetWorthHistoryChart
              points={netWorthHistory}
              currency={baseCurrency}
              privacyMode={privacyMode}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
