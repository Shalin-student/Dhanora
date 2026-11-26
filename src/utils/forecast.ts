import type { AppLanguage, AppState, Category, Transaction } from '../types/finance';
import { localizeShortDay } from '../i18n/localize';
import {
  advanceDateByFrequency,
  computeAccountBalance,
  computeMonthlySummary,
  getEffectiveCategoryAmounts,
  monthKeyFromDate,
  shiftMonth,
  todayISO,
} from './calculations';
import { convertCurrency } from './currency';

export interface CategoryEnvelopeWithRollover {
  category: Category;
  baseBudget: number;
  rolloverAmount: number;
  availableBudget: number;
  spent: number;
  remaining: number;
  percentage: number;
}

/**
 * Computes monthly expense category envelopes including carried-over surplus/deficit
 * from prior active months for categories with `rollover: true`.
 */
export function computeCategoryEnvelopesWithRollover(
  transactions: Transaction[],
  categories: Category[],
  targetMonth: string,
  memberFilterId: string | 'all' = 'all',
  maxLookbackMonths = 6
): CategoryEnvelopeWithRollover[] {
  // Collect distinct active months strictly before targetMonth within the lookback window
  const earliestWindowMonth = shiftMonth(targetMonth, -maxLookbackMonths);
  const activeMonthsBefore = new Set<string>();
  const spentByMonthAndCat = new Map<string, Map<string, number>>();

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (memberFilterId !== 'all' && tx.memberId !== memberFilterId) continue;

    const mKey = monthKeyFromDate(tx.date);
    if (mKey > targetMonth || mKey < earliestWindowMonth) continue;

    if (mKey < targetMonth) {
      activeMonthsBefore.add(mKey);
    }

    let monthMap = spentByMonthAndCat.get(mKey);
    if (!monthMap) {
      monthMap = new Map<string, number>();
      spentByMonthAndCat.set(mKey, monthMap);
    }
    for (const part of getEffectiveCategoryAmounts(tx)) {
      monthMap.set(part.categoryId, (monthMap.get(part.categoryId) ?? 0) + part.amount);
    }
  }

  const sortedPriorMonths = Array.from(activeMonthsBefore).sort();
  const targetSpentMap = spentByMonthAndCat.get(targetMonth) ?? new Map<string, number>();

  return categories
    .filter((c) => c.type === 'expense')
    .map((category) => {
      const baseBudget = category.budgetLimit ?? 0;
      let rolloverAmount = 0;

      if (category.rollover && baseBudget > 0 && sortedPriorMonths.length > 0) {
        let carry = 0;
        for (const mKey of sortedPriorMonths) {
          const spentInMonth = spentByMonthAndCat.get(mKey)?.get(category.id) ?? 0;
          carry = baseBudget + carry - spentInMonth;
        }
        rolloverAmount = Number(carry.toFixed(2));
      }

      const availableBudget = Math.max(0, Number((baseBudget + rolloverAmount).toFixed(2)));
      const spent = Number((targetSpentMap.get(category.id) ?? 0).toFixed(2));
      const remaining = Number((availableBudget - spent).toFixed(2));
      const percentage = availableBudget > 0 ? Math.round((spent / availableBudget) * 100) : 0;

      return {
        category,
        baseBudget,
        rolloverAmount,
        availableBudget,
        spent,
        remaining,
        percentage,
      };
    })
    .sort((a, b) => b.spent - a.spent);
}

export interface BudgetPaceSummary {
  daysInMonth: number;
  elapsedDays: number;
  remainingDays: number;
  monthElapsedPct: number;
  budgetUsedPct: number;
  expectedSpendAtPace: number;
  paceDelta: number; // positive = under pace (good), negative = overspending pace
  dailySafeToSpend: number;
}

export function computeBudgetPace(
  monthKey: string,
  totalAvailableBudget: number,
  totalSpent: number,
  referenceDate = todayISO()
): BudgetPaceSummary {
  const [y, m] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const refMonth = monthKeyFromDate(referenceDate);

  let elapsedDays: number;
  if (monthKey < refMonth) {
    elapsedDays = daysInMonth;
  } else if (monthKey > refMonth) {
    elapsedDays = 0;
  } else {
    elapsedDays = Math.min(daysInMonth, Math.max(1, Number(referenceDate.slice(8, 10))));
  }

  const remainingDays = Math.max(0, daysInMonth - elapsedDays);
  const monthElapsedPct = Math.round((elapsedDays / daysInMonth) * 100);
  const budgetUsedPct =
    totalAvailableBudget > 0 ? Math.round((totalSpent / totalAvailableBudget) * 100) : 0;
  const expectedSpendAtPace = Number(((totalAvailableBudget * elapsedDays) / daysInMonth).toFixed(2));
  const paceDelta = Number((expectedSpendAtPace - totalSpent).toFixed(2));
  const remainingBudget = Math.max(0, totalAvailableBudget - totalSpent);
  const dailySafeToSpend =
    remainingDays > 0
      ? Number((remainingBudget / remainingDays).toFixed(2))
      : monthKey === refMonth
      ? Number(remainingBudget.toFixed(2))
      : 0;

  return {
    daysInMonth,
    elapsedDays,
    remainingDays,
    monthElapsedPct,
    budgetUsedPct,
    expectedSpendAtPace,
    paceDelta,
    dailySafeToSpend,
  };
}

export interface ZeroBasedSummary {
  monthlyIncome: number;
  totalAssigned: number;
  unassigned: number;
  assignedPct: number;
}

export function computeZeroBasedSummary(
  state: AppState,
  monthKey: string,
  memberFilterId: string | 'all' = 'all'
): ZeroBasedSummary {
  const summary = computeMonthlySummary(state.transactions, monthKey, memberFilterId);
  const totalAssigned = state.categories
    .filter((c) => c.type === 'expense')
    .reduce((sum, c) => sum + (c.budgetLimit ?? 0), 0);

  const unassigned = Number((summary.income - totalAssigned).toFixed(2));
  const assignedPct =
    summary.income > 0 ? Math.round((totalAssigned / summary.income) * 100) : 0;

  return {
    monthlyIncome: summary.income,
    totalAssigned: Number(totalAssigned.toFixed(2)),
    unassigned,
    assignedPct,
  };
}

export interface ForecastDayPoint {
  date: string;
  label: string;
  balance: number;
  delta: number;
  events: Array<{ title: string; amount: number; type: 'income' | 'expense' | 'transfer' }>;
}

export interface CashflowForecastResult {
  points: ForecastDayPoint[];
  startingBalance: number;
  endingBalance: number;
  lowestBalance: number;
  lowestDate: string;
  netProjectedChange: number;
  lowBalanceAlerts: Array<{ date: string; balance: number; events: string[] }>;
}

function addDaysISO(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, '0');
  const nd = String(dt.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

/**
 * Simulates day-by-day balances over `horizonDays` (default 90 days)
 * using active `RecurringRule` inflows, outflows, and transfers.
 */
export function computeCashflowForecast(
  state: AppState,
  options: {
    scope?: 'checking' | 'liquid';
    horizonDays?: number;
    startDate?: string;
    lowBalanceThreshold?: number;
    language?: AppLanguage;
  } = {}
): CashflowForecastResult {
  const scope = options.scope ?? 'checking';
  const horizonDays = options.horizonDays ?? 90;
  const startDate = options.startDate ?? todayISO();
  const lowBalanceThreshold = options.lowBalanceThreshold ?? 1000;
  const language = options.language ?? 'en';
  const endDate = addDaysISO(startDate, horizonDays - 1);

  const includedTypes = new Set(
    scope === 'checking' ? ['checking', 'cash'] : ['checking', 'savings', 'cash']
  );
  const includedAccountIds = new Set(
    state.accounts.filter((a) => !a.isArchived && includedTypes.has(a.type)).map((a) => a.id)
  );

  let startingBalance = 0;
  for (const acc of state.accounts) {
    if (!includedAccountIds.has(acc.id)) continue;
    const rawBal = computeAccountBalance(acc, state.transactions);
    startingBalance += convertCurrency(
      rawBal,
      acc.currency,
      state.settings.baseCurrency,
      state.settings.exchangeRates
    );
  }
  startingBalance = Number(startingBalance.toFixed(2));

  // Index scheduled events by date
  const eventsByDate = new Map<
    string,
    Array<{ title: string; amount: number; type: 'income' | 'expense' | 'transfer' }>
  >();

  for (const rule of state.recurring) {
    if (!rule.isActive) continue;

    const fromIncluded = includedAccountIds.has(rule.accountId);
    const toIncluded = rule.toAccountId ? includedAccountIds.has(rule.toAccountId) : false;

    let signedDelta = 0;
    const baseAmt = convertCurrency(
      rule.amount,
      rule.currency,
      state.settings.baseCurrency,
      state.settings.exchangeRates
    );

    if (rule.type === 'income' && fromIncluded) {
      signedDelta = baseAmt;
    } else if (rule.type === 'expense' && fromIncluded) {
      signedDelta = -baseAmt;
    } else if (rule.type === 'transfer') {
      if (fromIncluded && !toIncluded) signedDelta = -baseAmt;
      else if (!fromIncluded && toIncluded) signedDelta = baseAmt;
    }

    if (signedDelta === 0) continue;

    let occDate = rule.nextDueDate;
    let guard = 0;
    while (occDate < startDate && guard < 24) {
      occDate = advanceDateByFrequency(occDate, rule.frequency);
      guard++;
    }

    let forwardGuard = 0;
    while (occDate <= endDate && forwardGuard < 100) {
      const list = eventsByDate.get(occDate) ?? [];
      list.push({ title: rule.title, amount: signedDelta, type: rule.type });
      eventsByDate.set(occDate, list);
      const next = advanceDateByFrequency(occDate, rule.frequency);
      if (next === occDate) break;
      occDate = next;
      forwardGuard++;
    }
  }

  const points: ForecastDayPoint[] = [];
  let runningBalance = startingBalance;
  let lowestBalance = startingBalance;
  let lowestDate = startDate;
  const lowBalanceAlerts: Array<{ date: string; balance: number; events: string[] }> = [];

  for (let i = 0; i < horizonDays; i++) {
    const date = addDaysISO(startDate, i);
    const dayEvents = eventsByDate.get(date) ?? [];
    const delta = Number(dayEvents.reduce((sum, ev) => sum + ev.amount, 0).toFixed(2));
    runningBalance = Number((runningBalance + delta).toFixed(2));

    if (runningBalance < lowestBalance) {
      lowestBalance = runningBalance;
      lowestDate = date;
    }

    if (runningBalance < lowBalanceThreshold && (i === 0 || delta < 0)) {
      lowBalanceAlerts.push({
        date,
        balance: runningBalance,
        events: dayEvents.map((e) => e.title),
      });
    }

    points.push({
      date,
      label: localizeShortDay(date, language),
      balance: runningBalance,
      delta,
      events: dayEvents,
    });
  }

  const endingBalance = points[points.length - 1]?.balance ?? startingBalance;

  return {
    points,
    startingBalance,
    endingBalance,
    lowestBalance,
    lowestDate,
    netProjectedChange: Number((endingBalance - startingBalance).toFixed(2)),
    lowBalanceAlerts,
  };
}
