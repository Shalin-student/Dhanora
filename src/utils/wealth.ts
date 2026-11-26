import type { AppLanguage, AppState, DebtItem, Transaction } from '../types/finance';
import {
  computeMonthlySummary,
  computeNetWorth,
  formatMonthLabel,
  shiftMonth,
} from './calculations';

export type DebtStrategy = 'minimum' | 'snowball' | 'avalanche';

export interface DebtPayoffSimulation {
  strategy: DebtStrategy;
  monthsToPayoff: number | null;
  totalInterestPaid: number;
  payoffOrder: Array<{ id: string; name: string; payoffMonth: number }>;
  monthlyRemainingBalances: number[];
}

/**
 * Simulates multi-debt amortization under Minimum-Only, Snowball (lowest balance first),
 * or Avalanche (highest APR first) with optional extra monthly budget.
 */
export function simulateDebtPayoff(
  debts: DebtItem[],
  strategy: DebtStrategy,
  extraMonthlyPayment = 0,
  maxMonths = 360
): DebtPayoffSimulation {
  const active = debts
    .filter((d) => d.currentBalance > 0)
    .map((d) => ({
      id: d.id,
      name: d.name,
      balance: d.currentBalance,
      apr: d.interestRateApr,
      minPay: Math.max(0, d.minimumPayment),
    }));

  if (active.length === 0) {
    return {
      strategy,
      monthsToPayoff: 0,
      totalInterestPaid: 0,
      payoffOrder: [],
      monthlyRemainingBalances: [0],
    };
  }

  const totalMinimumPool = active.reduce((sum, d) => sum + d.minPay, 0);
  const monthlyBudget =
    strategy === 'minimum' ? totalMinimumPool : totalMinimumPool + Math.max(0, extraMonthlyPayment);

  let totalInterestPaid = 0;
  let month = 0;
  const payoffOrder: Array<{ id: string; name: string; payoffMonth: number }> = [];
  const monthlyRemainingBalances: number[] = [
    Number(active.reduce((s, d) => s + d.balance, 0).toFixed(2)),
  ];

  while (active.some((d) => d.balance > 0.005) && month < maxMonths) {
    month++;

    // 1. Accrue monthly interest
    for (const d of active) {
      if (d.balance <= 0) continue;
      const monthlyRate = d.apr / 100 / 12;
      const interest = d.balance * monthlyRate;
      d.balance += interest;
      totalInterestPaid += interest;
    }

    // 2. Pay required minimums first
    let remainingPool = strategy === 'minimum' ? 0 : monthlyBudget;
    for (const d of active) {
      if (d.balance <= 0) continue;
      const pay = Math.min(d.balance, d.minPay);
      d.balance -= pay;
      if (strategy !== 'minimum') {
        remainingPool -= pay;
      }
      if (d.balance <= 0.005) {
        d.balance = 0;
        if (!payoffOrder.some((p) => p.id === d.id)) {
          payoffOrder.push({ id: d.id, name: d.name, payoffMonth: month });
        }
      }
    }

    // 3. Allocate snowball/avalanche surplus (freed minimums + extraMonthlyPayment)
    if (strategy !== 'minimum' && remainingPool > 0.005) {
      const prioritized = active
        .filter((d) => d.balance > 0)
        .sort((a, b) =>
          strategy === 'snowball'
            ? a.balance - b.balance
            : b.apr - a.apr || b.balance - a.balance
        );

      for (const target of prioritized) {
        if (remainingPool <= 0.005) break;
        const extraPay = Math.min(target.balance, remainingPool);
        target.balance -= extraPay;
        remainingPool -= extraPay;
        if (target.balance <= 0.005) {
          target.balance = 0;
          if (!payoffOrder.some((p) => p.id === target.id)) {
            payoffOrder.push({ id: target.id, name: target.name, payoffMonth: month });
          }
        }
      }
    }

    const totalBal = active.reduce((s, d) => s + d.balance, 0);
    monthlyRemainingBalances.push(Number(totalBal.toFixed(2)));
  }

  const allPaid = active.every((d) => d.balance <= 0.005);

  return {
    strategy,
    monthsToPayoff: allPaid ? month : null,
    totalInterestPaid: Number(totalInterestPaid.toFixed(2)),
    payoffOrder,
    monthlyRemainingBalances,
  };
}

export function compareDebtStrategies(debts: DebtItem[], extraMonthlyPayment: number) {
  const baseline = simulateDebtPayoff(debts, 'minimum', 0);
  const snowball = simulateDebtPayoff(debts, 'snowball', extraMonthlyPayment);
  const avalanche = simulateDebtPayoff(debts, 'avalanche', extraMonthlyPayment);

  const interestSavedSnowball =
    baseline.monthsToPayoff !== null && snowball.monthsToPayoff !== null
      ? Math.max(0, Number((baseline.totalInterestPaid - snowball.totalInterestPaid).toFixed(2)))
      : 0;
  const interestSavedAvalanche =
    baseline.monthsToPayoff !== null && avalanche.monthsToPayoff !== null
      ? Math.max(0, Number((baseline.totalInterestPaid - avalanche.totalInterestPaid).toFixed(2)))
      : 0;

  const monthsSavedSnowball =
    baseline.monthsToPayoff !== null && snowball.monthsToPayoff !== null
      ? Math.max(0, baseline.monthsToPayoff - snowball.monthsToPayoff)
      : 0;
  const monthsSavedAvalanche =
    baseline.monthsToPayoff !== null && avalanche.monthsToPayoff !== null
      ? Math.max(0, baseline.monthsToPayoff - avalanche.monthsToPayoff)
      : 0;

  return {
    baseline,
    snowball,
    avalanche,
    interestSavedSnowball,
    interestSavedAvalanche,
    monthsSavedSnowball,
    monthsSavedAvalanche,
  };
}

export interface NetWorthHistoryPoint {
  month: string;
  label: string;
  assets: number;
  liabilities: number;
  netWorth: number;
}

/**
 * Reconstructs historical month-end Net Worth over `monthsCount` months
 * by walking backward from the current snapshot using monthly net cashflow.
 */
export function computeNetWorthHistory(
  state: AppState,
  endMonth: string,
  monthsCount = 6,
  language: AppLanguage = 'en'
): NetWorthHistoryPoint[] {
  const current = computeNetWorth(state);
  const months = Array.from({ length: monthsCount }, (_, idx) =>
    shiftMonth(endMonth, idx - (monthsCount - 1))
  );

  // Walk backwards from endMonth: month[i] = month[i+1] - netSavings(month[i+1])
  const points: NetWorthHistoryPoint[] = new Array(months.length);
  let runningAssets = current.assets;
  const runningLiabilities = current.liabilities;

  for (let i = months.length - 1; i >= 0; i--) {
    const mKey = months[i];
    points[i] = {
      month: mKey,
      label: formatMonthLabel(mKey, language).split(' ')[0],
      assets: Number(runningAssets.toFixed(2)),
      liabilities: Number(runningLiabilities.toFixed(2)),
      netWorth: Number((runningAssets - runningLiabilities).toFixed(2)),
    };

    const mSummary = computeMonthlySummary(state.transactions, mKey, 'all');
    runningAssets = Math.max(0, runningAssets - mSummary.netSavings);
  }

  return points;
}

export interface PairwiseIouBalance {
  fromMemberId: string;
  toMemberId: string;
  netAmount: number;
  splitCount: number;
  txIds: string[];
}

/**
 * Aggregates and nets all unsettled member bill splits into minimal pairwise IOUs
 * (`fromMemberId` owes `toMemberId` `netAmount`).
 */
export function computeMemberIouBalances(transactions: Transaction[]): PairwiseIouBalance[] {
  const pairMap = new Map<
    string,
    { a: string; b: string; netAtoB: number; splitCount: number; txIds: Set<string> }
  >();

  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.memberSplits || tx.memberSplits.length === 0) continue;
    const payerId = tx.memberId;

    for (const sp of tx.memberSplits) {
      if (sp.settled || sp.memberId === payerId || sp.amount <= 0) continue;

      const [a, b] = payerId < sp.memberId ? [payerId, sp.memberId] : [sp.memberId, payerId];
      const key = `${a}::${b}`;
      let entry = pairMap.get(key);
      if (!entry) {
        entry = { a, b, netAtoB: 0, splitCount: 0, txIds: new Set() };
        pairMap.set(key, entry);
      }
      // sp.memberId owes payerId sp.amount
      if (sp.memberId === a) {
        entry.netAtoB += sp.amount;
      } else {
        entry.netAtoB -= sp.amount;
      }
      entry.splitCount++;
      entry.txIds.add(tx.id);
    }
  }

  const results: PairwiseIouBalance[] = [];
  for (const entry of pairMap.values()) {
    const rounded = Number(entry.netAtoB.toFixed(2));
    if (Math.abs(rounded) < 0.01) continue;
    results.push({
      fromMemberId: rounded > 0 ? entry.a : entry.b,
      toMemberId: rounded > 0 ? entry.b : entry.a,
      netAmount: Math.abs(rounded),
      splitCount: entry.splitCount,
      txIds: Array.from(entry.txIds),
    });
  }

  return results.sort((x, y) => y.netAmount - x.netAmount);
}
