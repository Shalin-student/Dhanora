import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { createSeedState } from '../data/seed';
import { resetMemoryFallbackForTests } from '../storage/repository';
import {
  applyRulesToTransactions,
  detectFinancialAnomalies,
  matchMerchantRule,
  runDueAutoPost,
} from '../utils/automation';
import { detectCsvDuplicates, mapCsvRowsToTransactions } from '../utils/csv';
import { createGuestDemoSession } from '../utils/auth';

describe('Smart Automation Engine (Unit)', () => {
  it('idempotently auto-posts due recurring schedules without duplicating', () => {
    const seed = createSeedState();
    const stateWithDue = {
      ...seed,
      recurring: [
        {
          id: 'rec-due-test',
          title: 'Fiber Gigabit Plan',
          type: 'expense' as const,
          amount: 79.99,
          currency: 'USD' as const,
          frequency: 'monthly' as const,
          nextDueDate: '2026-11-20',
          categoryId: 'cat-utilities',
          accountId: 'acc-joint',
          memberId: 'm-shared',
          autoPost: true,
          isActive: true,
        },
      ],
    };

    const firstRun = runDueAutoPost(stateWithDue, '2026-11-25');
    expect(firstRun.postedCount).toBe(1);
    expect(firstRun.postedTitles).toEqual(['Fiber Gigabit Plan']);
    expect(firstRun.nextState.transactions[0].merchant).toBe('Fiber Gigabit Plan');
    expect(firstRun.nextState.recurring[0].nextDueDate).toBe('2026-12-20');
    expect(firstRun.nextState.recurring[0].lastPostedDate).toBe('2026-11-20');

    // Second run on same day should post 0 additional entries
    const secondRun = runDueAutoPost(firstRun.nextState, '2026-11-25');
    expect(secondRun.postedCount).toBe(0);
    expect(secondRun.nextState.transactions.length).toBe(
      firstRun.nextState.transactions.length
    );
  });

  it('matches merchant rules by precedence and batch-updates existing transactions', () => {
    const seed = createSeedState();
    const rules = [
      {
        id: 'r-contains',
        pattern: 'Coffee',
        matchType: 'contains' as const,
        categoryId: 'cat-dining',
        tags: ['cafe'],
        isActive: true,
      },
      {
        id: 'r-exact',
        pattern: 'Blue Bottle Coffee',
        matchType: 'exact' as const,
        categoryId: 'cat-shopping',
        tags: ['beans'],
        isActive: true,
      },
      {
        id: 'r-inactive',
        pattern: 'Inactive',
        matchType: 'contains' as const,
        categoryId: 'cat-kids',
        isActive: false,
      },
    ];

    expect(matchMerchantRule('Blue Bottle Coffee', rules)?.id).toBe('r-exact');
    expect(matchMerchantRule('Local Coffee Roasters', rules)?.id).toBe('r-contains');
    expect(matchMerchantRule('Inactive Store', rules)).toBeNull();

    const customTx = {
      ...seed.transactions[3],
      id: 'tx-unmatched',
      merchant: 'Local Coffee Roasters',
      categoryId: 'cat-shopping',
      tags: ['morning'],
    };

    const { transactions, updatedCount } = applyRulesToTransactions([customTx], rules);
    expect(updatedCount).toBe(1);
    expect(transactions[0].categoryId).toBe('cat-dining');
    expect(transactions[0].tags).toEqual(['morning', 'cafe']);
  });

  it('detects CSV duplicate rows and applies merchant rules during CSV mapping', () => {
    const seed = createSeedState();
    const existing = seed.transactions[0]; // Northstar Tech Payroll, 5400, date

    const rows = [
      [existing.date, existing.merchant, String(existing.amount), existing.type],
      ['2026-11-21', 'Trader Joe Market #12', '-95.40', 'expense'],
      ['2026-11-21', 'Trader Joe Market #12', '-95.40', 'expense'], // in-batch duplicate
    ];

    const candidates = mapCsvRowsToTransactions(
      rows,
      { dateCol: 0, merchantCol: 1, amountCol: 2, typeCol: 3, categoryCol: -1, noteCol: -1 },
      {
        accountId: 'acc-joint',
        memberId: 'm-alex',
        baseCurrency: 'USD',
        exchangeRates: seed.settings.exchangeRates,
        categories: seed.categories,
        rules: seed.rules,
      }
    );

    expect(candidates[1].categoryId).toBe('cat-groceries'); // matched Trader Joe rule
    expect(candidates[1].tags).toContain('weekly-groceries');

    const { unique, duplicates } = detectCsvDuplicates(candidates, seed.transactions);
    expect(unique).toHaveLength(1);
    expect(duplicates).toHaveLength(2);
  });

  it('flags recurring price hikes and category spend spikes', () => {
    const seed = createSeedState();
    const monthKey = seed.transactions[0].date.slice(0, 7);
    const hikedState = {
      ...seed,
      recurring: [
        ...seed.recurring,
        {
          id: 'rec-hike',
          title: 'Oakridge Mortgage',
          type: 'expense' as const,
          amount: 2500, // higher than historical 2150 Oakridge Mortgage Co. / recurring
          currency: 'USD' as const,
          frequency: 'monthly' as const,
          nextDueDate: `${monthKey}-28`,
          categoryId: 'cat-housing',
          accountId: 'acc-joint',
          memberId: 'm-shared',
          autoPost: false,
          isActive: true,
        },
      ],
      transactions: [
        {
          ...seed.transactions[3],
          id: 'tx-prior-rec',
          recurringId: 'rec-hike',
          merchant: 'Oakridge Mortgage',
          amount: 2150,
          baseAmount: 2150,
        },
        ...seed.transactions,
      ],
    };

    const alerts = detectFinancialAnomalies(hikedState, monthKey, `${monthKey}-28`);
    expect(alerts.some((a) => a.kind === 'price-hike' && a.title.includes('Oakridge Mortgage'))).toBe(
      true
    );
  });
});

describe('Smart Automation UI Flows', () => {
  beforeEach(() => {
    localStorage.clear();
    resetMemoryFallbackForTests();
    createGuestDemoSession(0);
  });

  it('auto-matches merchant rules inside QuickAddModal as user types', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Add Transaction/i }));

    const merchantInput = screen.getByPlaceholderText(/Trader Joe/i);
    fireEvent.change(merchantInput, { target: { value: 'Trader Joe #44' } });

    expect(screen.getByText(/Auto-matched rule: .*Trader Joe/i)).toBeInTheDocument();
  });

  it('navigates to Automation & Rules, creates a new rule, and applies rules to ledger', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Automation & Rules/i }));

    expect(
      await screen.findByText(/Smart Automation, Rules & Anomaly Alerts/i)
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Merchant rule pattern'), {
      target: { value: 'Target Store' },
    });
    fireEvent.change(screen.getByLabelText('Rule auto-tags'), {
      target: { value: 'household' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add Rule/i }));

    await waitFor(() => {
      expect(screen.getByText(/“Target Store”/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Apply Rules to Ledger/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/All matching transactions already follow your rules|Updated/i)
      ).toBeInTheDocument();
    });
  });
});
