import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { createSeedState } from '../data/seed';
import { resetMemoryFallbackForTests } from '../storage/repository';
import { computeNetWorth } from '../utils/calculations';
import {
  compareDebtStrategies,
  computeMemberIouBalances,
  computeNetWorthHistory,
} from '../utils/wealth';
import { createGuestDemoSession } from '../utils/auth';

describe('Wealth & Debt Engine (Unit)', () => {
  it('compares Debt Snowball vs Avalanche and confirms Avalanche saves maximum interest', () => {
    const debts = [
      {
        id: 'd-small-low',
        name: 'Small Low-APR Loan',
        lender: 'Credit Union',
        originalAmount: 4000,
        currentBalance: 2000,
        interestRateApr: 3.0,
        minimumPayment: 100,
        dueDay: 10,
        ownerId: 'm-alex',
      },
      {
        id: 'd-big-high',
        name: 'High-APR Card',
        lender: 'Bank',
        originalAmount: 6000,
        currentBalance: 5000,
        interestRateApr: 19.5,
        minimumPayment: 150,
        dueDay: 15,
        ownerId: 'm-alex',
      },
    ];

    const comparison = compareDebtStrategies(debts, 300);

    expect(comparison.baseline.monthsToPayoff).toBeGreaterThan(comparison.avalanche.monthsToPayoff!);
    expect(comparison.avalanche.payoffOrder[0].id).toBe('d-big-high');
    expect(comparison.snowball.payoffOrder[0].id).toBe('d-small-low');
    expect(comparison.interestSavedAvalanche).toBeGreaterThan(comparison.interestSavedSnowball);
    expect(comparison.monthsSavedAvalanche).toBeGreaterThan(0);
  });

  it('reconstructs 6-month Net Worth history ending at current snapshot', () => {
    const seed = createSeedState();
    const endMonth = seed.transactions[0].date.slice(0, 7);
    const history = computeNetWorthHistory(seed, endMonth, 6);
    const current = computeNetWorth(seed);

    expect(history).toHaveLength(6);
    expect(history[5].month).toBe(endMonth);
    expect(history[5].netWorth).toBe(current.netWorth);
    expect(history[5].netWorth).toBeGreaterThan(history[0].netWorth);
  });

  it('nets reciprocal family member IOUs and ignores settled splits', () => {
    const seed = createSeedState();
    const baseTx = seed.transactions[3];

    const txs = [
      {
        ...baseTx,
        id: 'tx-a',
        memberId: 'm-alex',
        memberSplits: [
          { memberId: 'm-alex', amount: 100, settled: true },
          { memberId: 'm-maya', amount: 140, settled: false }, // Maya owes Alex 140
        ],
      },
      {
        ...baseTx,
        id: 'tx-b',
        memberId: 'm-maya',
        memberSplits: [
          { memberId: 'm-maya', amount: 40, settled: true },
          { memberId: 'm-alex', amount: 40, settled: false }, // Alex owes Maya 40
        ],
      },
    ];

    const ious = computeMemberIouBalances(txs);
    expect(ious).toHaveLength(1);
    expect(ious[0].fromMemberId).toBe('m-maya');
    expect(ious[0].toMemberId).toBe('m-alex');
    expect(ious[0].netAmount).toBe(100);
    expect(ious[0].splitCount).toBe(2);
  });
});

describe('Wealth, Debt Simulator & 1-Click IOU UI Flows', () => {
  beforeEach(() => {
    localStorage.clear();
    resetMemoryFallbackForTests();
    createGuestDemoSession(0);
  });

  it('updates Debt Snowball vs Avalanche simulator when extra monthly payment changes', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Goals & Debts/i }));

    expect(
      await screen.findByText('Snowball vs. Avalanche Payoff Simulator')
    ).toBeInTheDocument();

    const slider = screen.getByLabelText('Extra Monthly Payment:');
    fireEvent.change(slider, { target: { value: '600' } });
    expect(screen.getByText('+$600.00/mo')).toBeInTheDocument();
  });

  it('renders 6-Month Net Worth History in Accounts & Net Worth', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Accounts & Net Worth/i }));

    expect(await screen.findByText('6-Month Net Worth History')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '6-month net worth history chart' })).toBeInTheDocument();
  });

  it('settles pairwise family IOUs in 1 click and supports Undo', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Family & Splits/i }));

    expect(await screen.findByText('Net Family IOU Settlement Plan')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Settle All/i }));
    expect(screen.queryByText('Net Family IOU Settlement Plan')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Settled Maya → Household IOU/i).length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole('button', { name: /Undo/i }));
    expect(screen.getByText('Net Family IOU Settlement Plan')).toBeInTheDocument();
  });
});
