import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { createSeedState } from '../data/seed';
import { resetMemoryFallbackForTests } from '../storage/repository';
import {
  computeBudgetPace,
  computeCashflowForecast,
  computeCategoryEnvelopesWithRollover,
  computeZeroBasedSummary,
} from '../utils/forecast';
import { createGuestDemoSession } from '../utils/auth';

describe('Predictive Finance Engine (Unit)', () => {
  it('carries prior-month unspent and overspent balances for rollover categories only', () => {
    const seed = createSeedState();
    const cats = [
      {
        id: 'cat-roll',
        name: 'Groceries',
        type: 'expense' as const,
        icon: '🛒',
        color: '#10b981',
        bucket: 'needs' as const,
        budgetLimit: 500,
        rollover: true,
      },
      {
        id: 'cat-noroll',
        name: 'Dining',
        type: 'expense' as const,
        icon: '🍽️',
        color: '#f97316',
        bucket: 'wants' as const,
        budgetLimit: 300,
        rollover: false,
      },
    ];

    const txs = [
      // Oct: Groceries spent 350 (+150 unspent rolls into Nov), Dining spent 100 (no rollover)
      {
        ...seed.transactions[3],
        id: 'tx-oct-1',
        date: '2026-10-10',
        categoryId: 'cat-roll',
        amount: 350,
        baseAmount: 350,
        categorySplits: undefined,
        memberSplits: undefined,
      },
      {
        ...seed.transactions[3],
        id: 'tx-oct-2',
        date: '2026-10-12',
        categoryId: 'cat-noroll',
        amount: 100,
        baseAmount: 100,
        categorySplits: undefined,
        memberSplits: undefined,
      },
      // Nov: Groceries spent 200 out of (500 + 150 = 650)
      {
        ...seed.transactions[3],
        id: 'tx-nov-1',
        date: '2026-11-10',
        categoryId: 'cat-roll',
        amount: 200,
        baseAmount: 200,
        categorySplits: undefined,
        memberSplits: undefined,
      },
    ];

    const envelopes = computeCategoryEnvelopesWithRollover(txs, cats, '2026-11', 'all');
    const rollEnv = envelopes.find((e) => e.category.id === 'cat-roll')!;
    const noRollEnv = envelopes.find((e) => e.category.id === 'cat-noroll')!;

    expect(rollEnv.baseBudget).toBe(500);
    expect(rollEnv.rolloverAmount).toBe(150);
    expect(rollEnv.availableBudget).toBe(650);
    expect(rollEnv.remaining).toBe(450);

    expect(noRollEnv.rolloverAmount).toBe(0);
    expect(noRollEnv.availableBudget).toBe(300);
  });

  it('computes mid-month spending pace and daily safe-to-spend accurately', () => {
    const pace = computeBudgetPace('2026-11', 3000, 1200, '2026-11-15');
    expect(pace.daysInMonth).toBe(30);
    expect(pace.elapsedDays).toBe(15);
    expect(pace.remainingDays).toBe(15);
    expect(pace.monthElapsedPct).toBe(50);
    expect(pace.expectedSpendAtPace).toBe(1500);
    expect(pace.paceDelta).toBe(300); // $300 under pace
    expect(pace.dailySafeToSpend).toBe(120); // (3000 - 1200) / 15
  });

  it('computes zero-based assignment balance', () => {
    const seed = createSeedState();
    const zbb = computeZeroBasedSummary(seed, seed.transactions[0].date.slice(0, 7));
    expect(zbb.monthlyIncome).toBe(10330);
    expect(zbb.totalAssigned).toBe(7470);
    expect(zbb.unassigned).toBe(2860);
  });

  it('simulates 90-day cashflow forecast and triggers low-balance alerts', () => {
    const seed = createSeedState();
    const customState = {
      ...seed,
      accounts: [
        {
          id: 'acc-chk',
          name: 'Checking',
          type: 'checking' as const,
          ownerId: 'm-alex',
          initialBalance: 2000,
          color: '#2563eb',
          currency: 'USD' as const,
        },
      ],
      transactions: [],
      recurring: [
        {
          id: 'r-rent',
          title: 'Rent',
          type: 'expense' as const,
          amount: 1500,
          currency: 'USD' as const,
          frequency: 'monthly' as const,
          nextDueDate: '2026-11-28',
          categoryId: 'cat-housing',
          accountId: 'acc-chk',
          memberId: 'm-alex',
          autoPost: true,
          isActive: true,
        },
        {
          id: 'r-pay',
          title: 'Paycheck',
          type: 'income' as const,
          amount: 2000,
          currency: 'USD' as const,
          frequency: 'monthly' as const,
          nextDueDate: '2026-12-05',
          categoryId: 'cat-salary',
          accountId: 'acc-chk',
          memberId: 'm-alex',
          autoPost: true,
          isActive: true,
        },
      ],
    };

    const forecast = computeCashflowForecast(customState, {
      scope: 'checking',
      horizonDays: 90,
      startDate: '2026-11-25',
      lowBalanceThreshold: 1000,
    });

    expect(forecast.points).toHaveLength(90);
    expect(forecast.startingBalance).toBe(2000);
    expect(forecast.lowestBalance).toBe(500); // 2000 - 1500 on 2026-11-28
    expect(forecast.lowestDate).toBe('2026-11-28');
    expect(forecast.lowBalanceAlerts.length).toBeGreaterThanOrEqual(1);
    expect(forecast.lowBalanceAlerts[0].date).toBe('2026-11-28');
  });
});

describe('Predictive Finance UI Flows', () => {
  beforeEach(() => {
    localStorage.clear();
    resetMemoryFallbackForTests();
    createGuestDemoSession(0);
  });

  it('renders 90-Day Balance Forecast on Dashboard and toggles account scope', () => {
    render(<App />);
    expect(screen.getByText('90-Day Balance Forecast')).toBeInTheDocument();

    const checkingBtn = screen.getByRole('button', { name: 'Checking + Cash' });
    const liquidBtn = screen.getByRole('button', { name: 'All Liquid' });
    expect(checkingBtn).toBeInTheDocument();
    fireEvent.click(liquidBtn);
    expect(screen.getByText('90-Day Net Delta')).toBeInTheDocument();
  });

  it('shows rollover math, month pace, and Zero-Based toggle in BudgetsView', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Budgets & 50/30/20' }));

    expect(await screen.findByText('Daily Safe-to-Spend')).toBeInTheDocument();
    expect(screen.getAllByText(/Rollover:/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Zero-Based' }));
    expect(screen.getByText('Assigned to Envelopes')).toBeInTheDocument();
    expect(screen.getByText('Left to Assign')).toBeInTheDocument();
  });
});
