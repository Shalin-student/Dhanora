import { describe, expect, it } from 'vitest';
import { createSeedState } from '../data/seed';
import {
  advanceDateByFrequency,
  compute503020Breakdown,
  computeAccountBalance,
  computeCategorySpending,
  computeFinancialHealthScore,
  computeMemberSummaries,
  computeMonthlySummary,
  computeNetWorth,
  debtPayoffMonths,
  goalMonthlyContributionNeeded,
  todayISO,
} from '../utils/calculations';
import { convertCurrency, formatMoney } from '../utils/currency';
import { exportTransactionsToCsv, mapCsvRowsToTransactions, parseCsvText } from '../utils/csv';

describe('Currency & formatting helpers', () => {
  it('converts between currencies and formats privacy mode', () => {
    const rates = { USD: 1, EUR: 0.9, GBP: 0.8, INR: 85, CAD: 1.4, AUD: 1.5, JPY: 150 };
    expect(convertCurrency(100, 'USD', 'EUR', rates)).toBe(90);
    expect(convertCurrency(90, 'EUR', 'USD', rates)).toBe(100);
    expect(formatMoney(1234.5, 'USD', false)).toBe('$1,234.50');
    expect(formatMoney(1234.5, 'USD', true)).toBe('$••••');
  });
});

describe('Financial calculations & splits', () => {
  it('computes monthly income, expense, net savings, and category splits accurately', () => {
    const state = createSeedState();
    const monthKey = todayISO().slice(0, 7);
    const summary = computeMonthlySummary(state.transactions, monthKey, 'all');

    expect(summary.income).toBe(10330); // 5400 + 4250 + 680
    expect(summary.expense).toBeGreaterThan(3500);
    expect(summary.netSavings).toBe(Number((summary.income - summary.expense).toFixed(2)));

    // Verify split transaction (Costco $284.50 split into $214.50 groceries + $70 shopping)
    const catSpending = computeCategorySpending(
      state.transactions,
      state.categories,
      monthKey,
      'expense'
    );
    const shopping = catSpending.find((c) => c.category.id === 'cat-shopping');
    expect(shopping?.spent).toBe(70);
  });

  it('computes account balances including transfers and net worth', () => {
    const state = createSeedState();
    const hys = state.accounts.find((a) => a.id === 'acc-hys')!;
    const hysBal = computeAccountBalance(hys, state.transactions);
    // 19500 initial + 1000 transfer in = 20500
    expect(hysBal).toBe(20500);

    const netWorth = computeNetWorth(state);
    expect(netWorth.assets).toBeGreaterThan(netWorth.liabilities);
    expect(netWorth.netWorth).toBe(Number((netWorth.assets - netWorth.liabilities).toFixed(2)));
  });

  it('computes 50/30/20, health score, member IOU splits, goals, and debt payoff', () => {
    const state = createSeedState();
    const monthKey = todayISO().slice(0, 7);
    const ratio = compute503020Breakdown(state.transactions, state.categories, monthKey);
    expect(ratio.needs).toBeGreaterThan(0);
    expect(ratio.wants).toBeGreaterThan(0);

    const health = computeFinancialHealthScore(state, monthKey);
    expect(health.score).toBeGreaterThanOrEqual(50);
    expect(health.score).toBeLessThanOrEqual(100);

    const members = computeMemberSummaries(state.members, state.transactions, monthKey);
    const maya = members.find((m) => m.member.id === 'm-maya')!;
    expect(maya.splitOwedToOthers).toBe(142.25);

    expect(advanceDateByFrequency('2026-01-15', 'monthly')).toBe('2026-02-15');
    expect(goalMonthlyContributionNeeded(state.goals[0], todayISO())).toBeGreaterThan(0);
    expect(debtPayoffMonths(state.debts[0])).toBeGreaterThan(0);
  });

  it('exports and imports CSV statements cleanly', () => {
    const state = createSeedState();
    const csv = exportTransactionsToCsv(
      state.transactions.slice(0, 3),
      state.categories,
      state.accounts,
      state.members
    );
    const parsed = parseCsvText(csv);
    expect(parsed.length).toBe(4); // header + 3 rows

    const imported = mapCsvRowsToTransactions(
      parsed.slice(1),
      { dateCol: 0, merchantCol: 2, amountCol: 4, typeCol: 1, categoryCol: 3, noteCol: 12 },
      {
        accountId: 'acc-joint',
        memberId: 'm-alex',
        baseCurrency: 'USD',
        exchangeRates: state.settings.exchangeRates,
        categories: state.categories,
      }
    );
    expect(imported.length).toBe(3);
    expect(imported[0].merchant).toBe('Northstar Tech Payroll');
  });
});
