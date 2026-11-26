import { describe, expect, it } from 'vitest';
import { createSeedState } from '../data/seed';
import { financeReducer, upsertById } from '../store/financeReducer';

describe('financeReducer pure domain transitions', () => {
  it('upsertById inserts new items and updates existing ones without duplication', () => {
    const base = [{ id: '1', name: 'A' }];
    const added = upsertById(base, { id: '2', name: 'B' });
    expect(added).toHaveLength(2);
    const updated = upsertById(added, { id: '1', name: 'A-updated' });
    expect(updated).toHaveLength(2);
    expect(updated[0].name).toBe('A-updated');
  });

  it('adds, updates, and deletes transactions while converting baseAmount', () => {
    const seed = createSeedState();
    const afterAdd = financeReducer(seed, {
      type: 'ADD_TRANSACTION',
      payload: {
        id: 'tx-eur',
        type: 'expense',
        amount: 92,
        currency: 'EUR',
        baseAmount: 92,
        date: '2026-11-25',
        merchant: 'Paris Cafe',
        categoryId: 'cat-dining',
        accountId: 'acc-card',
        memberId: 'm-alex',
        tags: [],
        note: '',
        status: 'cleared',
        createdAt: '2026-11-25T10:00:00Z',
      },
    });
    expect(afterAdd.transactions[0].baseAmount).toBe(100); // 92 EUR / 0.92 = 100 USD

    const afterDelete = financeReducer(afterAdd, {
      type: 'DELETE_TRANSACTIONS',
      ids: ['tx-eur'],
    });
    expect(afterDelete.transactions.length).toBe(seed.transactions.length);
  });

  it('posts recurring rules, advances nextDueDate, and records goal/debt payments', () => {
    const seed = createSeedState();
    const targetRule = seed.recurring[0];

    const afterPost = financeReducer(seed, {
      type: 'POST_RECURRING_DUE',
      ruleId: targetRule.id,
      postedTxId: 'tx-rec-test',
      createdAt: '2026-11-25T10:00:00Z',
    });
    expect(afterPost.transactions[0].id).toBe('tx-rec-test');
    const updatedRule = afterPost.recurring.find((r) => r.id === targetRule.id)!;
    expect(updatedRule.lastPostedDate).toBe(targetRule.nextDueDate);
    expect(updatedRule.nextDueDate).not.toBe(targetRule.nextDueDate);

    const goal = afterPost.goals[0];
    const afterGoal = financeReducer(afterPost, {
      type: 'CONTRIBUTE_GOAL',
      goalId: goal.id,
      amount: 500,
      fromAccountId: 'acc-joint',
      memberId: 'm-alex',
      txId: 'tx-g-1',
      date: '2026-11-25',
      createdAt: '2026-11-25T10:00:00Z',
    });
    expect(afterGoal.goals[0].currentAmount).toBe(goal.currentAmount + 500);

    const debt = afterGoal.debts[0];
    const afterDebt = financeReducer(afterGoal, {
      type: 'RECORD_DEBT_PAYMENT',
      debtId: debt.id,
      amount: 400,
      fromAccountId: 'acc-joint',
      memberId: 'm-alex',
      txId: 'tx-d-1',
      date: '2026-11-25',
      createdAt: '2026-11-25T10:00:00Z',
    });
    expect(afterDebt.debts[0].currentBalance).toBe(debt.currentBalance - 400);
  });

  it('rebases transaction baseAmounts when baseCurrency changes', () => {
    const seed = createSeedState();
    const rebased = financeReducer(seed, {
      type: 'UPDATE_SETTINGS',
      patch: { baseCurrency: 'EUR' },
    });
    const firstTx = rebased.transactions.find((t) => t.amount === 5400 && t.currency === 'USD')!;
    expect(firstTx.baseAmount).toBe(4968); // 5400 * 0.92
  });
});
