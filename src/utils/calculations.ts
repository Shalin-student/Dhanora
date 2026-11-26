import type {
  Account,
  AppLanguage,
  AppState,
  BudgetBucket,
  Category,
  DebtItem,
  FamilyMember,
  RecurrenceFrequency,
  SavingsGoal,
  Transaction,
} from '../types/finance';
import { localizeCategoryName, localizeMonthLabel } from '../i18n/localize';
import { convertCurrency } from './currency';

export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function monthKeyFromDate(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function shiftMonth(monthKey: string, deltaMonths: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + deltaMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(monthKey: string, language: AppLanguage = 'en'): string {
  return localizeMonthLabel(monthKey, language);
}

export function advanceDateByFrequency(dateStr: string, frequency: RecurrenceFrequency): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  switch (frequency) {
    case 'weekly':
      dt.setDate(dt.getDate() + 7);
      break;
    case 'biweekly':
      dt.setDate(dt.getDate() + 14);
      break;
    case 'monthly':
      dt.setMonth(dt.getMonth() + 1);
      break;
    case 'quarterly':
      dt.setMonth(dt.getMonth() + 3);
      break;
    case 'yearly':
      dt.setFullYear(dt.getFullYear() + 1);
      break;
  }
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, '0');
  const nd = String(dt.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

/**
 * Computes current account balance from initialBalance + transactions (optionally restricted to cleared items).
 */
export function computeAccountBalance(
  account: Account,
  transactions: Transaction[],
  clearedOnly = false
): number {
  let balance = account.initialBalance;
  for (const tx of transactions) {
    if (clearedOnly && tx.status !== 'cleared') continue;
    if (tx.accountId === account.id) {
      if (tx.type === 'income') balance += tx.amount;
      else if (tx.type === 'expense') balance -= tx.amount;
      else if (tx.type === 'transfer') balance -= tx.amount;
    }
    if (tx.type === 'transfer' && tx.toAccountId === account.id) {
      balance += tx.amount;
    }
  }
  return Number(balance.toFixed(2));
}

export function computeClearedAccountBalance(account: Account, transactions: Transaction[]): number {
  return computeAccountBalance(account, transactions, true);
}

export function computeNetWorth(state: AppState): {
  assets: number;
  liabilities: number;
  netWorth: number;
  accountBalances: Record<string, number>;
} {
  const accountBalances: Record<string, number> = {};
  let assets = 0;
  let liabilities = 0;

  for (const acc of state.accounts) {
    const bal = computeAccountBalance(acc, state.transactions);
    accountBalances[acc.id] = bal;
    const baseBal = convertCurrency(
      bal,
      acc.currency,
      state.settings.baseCurrency,
      state.settings.exchangeRates
    );
    if (acc.type === 'credit') {
      if (baseBal < 0) liabilities += Math.abs(baseBal);
      else assets += baseBal;
    } else {
      if (baseBal >= 0) assets += baseBal;
      else liabilities += Math.abs(baseBal);
    }
  }

  for (const debt of state.debts) {
    liabilities += debt.currentBalance;
  }

  return {
    assets: Number(assets.toFixed(2)),
    liabilities: Number(liabilities.toFixed(2)),
    netWorth: Number((assets - liabilities).toFixed(2)),
    accountBalances,
  };
}

export interface MonthlySummary {
  month: string;
  income: number;
  expense: number;
  netSavings: number;
  savingsRate: number;
}

export function getEffectiveCategoryAmounts(tx: Transaction): Array<{ categoryId: string; amount: number }> {
  if (tx.categorySplits && tx.categorySplits.length > 0) {
    const totalSplit = tx.categorySplits.reduce((s, sp) => s + sp.amount, 0) || 1;
    const ratio = tx.baseAmount / (tx.amount || 1);
    return tx.categorySplits.map((sp) => ({
      categoryId: sp.categoryId,
      amount: Number(((sp.amount * ratio * (tx.amount / totalSplit)) || sp.amount * ratio).toFixed(2)),
    }));
  }
  return [{ categoryId: tx.categoryId, amount: tx.baseAmount }];
}

export function computeMonthlySummary(
  transactions: Transaction[],
  monthKey: string,
  memberFilterId: string | 'all' = 'all'
): MonthlySummary {
  let income = 0;
  let expense = 0;

  for (const tx of transactions) {
    if (monthKeyFromDate(tx.date) !== monthKey) continue;
    if (memberFilterId !== 'all' && tx.memberId !== memberFilterId) continue;
    if (tx.type === 'income') income += tx.baseAmount;
    else if (tx.type === 'expense') expense += tx.baseAmount;
  }

  const netSavings = income - expense;
  const savingsRate = income > 0 ? Math.round((netSavings / income) * 1000) / 10 : 0;

  return {
    month: monthKey,
    income: Number(income.toFixed(2)),
    expense: Number(expense.toFixed(2)),
    netSavings: Number(netSavings.toFixed(2)),
    savingsRate,
  };
}

export function computeCategorySpending(
  transactions: Transaction[],
  categories: Category[],
  monthKey: string,
  type: 'expense' | 'income' = 'expense',
  memberFilterId: string | 'all' = 'all'
): Array<{ category: Category; spent: number; budget: number; percentage: number }> {
  const spentMap = new Map<string, number>();

  for (const tx of transactions) {
    if (tx.type !== type) continue;
    if (monthKeyFromDate(tx.date) !== monthKey) continue;
    if (memberFilterId !== 'all' && tx.memberId !== memberFilterId) continue;

    for (const part of getEffectiveCategoryAmounts(tx)) {
      spentMap.set(part.categoryId, (spentMap.get(part.categoryId) ?? 0) + part.amount);
    }
  }

  return categories
    .filter((c) => c.type === type)
    .map((category) => {
      const spent = Number((spentMap.get(category.id) ?? 0).toFixed(2));
      const budget = category.budgetLimit ?? 0;
      const percentage = budget > 0 ? Math.round((spent / budget) * 100) : 0;
      return { category, spent, budget, percentage };
    })
    .sort((a, b) => b.spent - a.spent);
}

export function compute503020Breakdown(
  transactions: Transaction[],
  categories: Category[],
  monthKey: string,
  memberFilterId: string | 'all' = 'all'
): {
  income: number;
  needs: number;
  wants: number;
  savings: number;
  needsPct: number;
  wantsPct: number;
  savingsPct: number;
} {
  const summary = computeMonthlySummary(transactions, monthKey, memberFilterId);
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const buckets: Record<BudgetBucket, number> = {
    needs: 0,
    wants: 0,
    savings: 0,
  };

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (monthKeyFromDate(tx.date) !== monthKey) continue;
    if (memberFilterId !== 'all' && tx.memberId !== memberFilterId) continue;

    for (const part of getEffectiveCategoryAmounts(tx)) {
      const cat = categoryMap.get(part.categoryId);
      const bucket = cat?.bucket ?? 'wants';
      buckets[bucket] += part.amount;
    }
  }

  const netPositiveSavings = Math.max(0, summary.netSavings) + buckets.savings;
  const totalBase = summary.income > 0 ? summary.income : buckets.needs + buckets.wants + netPositiveSavings || 1;

  return {
    income: summary.income,
    needs: Number(buckets.needs.toFixed(2)),
    wants: Number(buckets.wants.toFixed(2)),
    savings: Number(netPositiveSavings.toFixed(2)),
    needsPct: Math.round((buckets.needs / totalBase) * 100),
    wantsPct: Math.round((buckets.wants / totalBase) * 100),
    savingsPct: Math.round((netPositiveSavings / totalBase) * 100),
  };
}

export interface MemberBalanceSummary {
  member: FamilyMember;
  income: number;
  expense: number;
  net: number;
  allowanceUsedPct: number;
  splitOwedToOthers: number;
  splitOwedByOthers: number;
}

export function computeMemberSummaries(
  members: FamilyMember[],
  transactions: Transaction[],
  monthKey: string
): MemberBalanceSummary[] {
  const stats = new Map<
    string,
    { income: number; expense: number; owedToOthers: number; owedByOthers: number }
  >();
  for (const m of members) {
    stats.set(m.id, { income: 0, expense: 0, owedToOthers: 0, owedByOthers: 0 });
  }

  for (const tx of transactions) {
    const inMonth = monthKeyFromDate(tx.date) === monthKey;
    const entry = stats.get(tx.memberId);
    if (inMonth && entry) {
      if (tx.type === 'income') entry.income += tx.baseAmount;
      if (tx.type === 'expense') entry.expense += tx.baseAmount;
    }

    // Shared member split settlement tracking across all unsettled transactions
    if (tx.type === 'expense' && tx.memberSplits && tx.memberSplits.length > 0) {
      const payerEntry = stats.get(tx.memberId);
      for (const sp of tx.memberSplits) {
        if (sp.settled || sp.memberId === tx.memberId) continue;
        const participant = stats.get(sp.memberId);
        if (participant) participant.owedToOthers += sp.amount;
        if (payerEntry) payerEntry.owedByOthers += sp.amount;
      }
    }
  }

  return members.map((member) => {
    const s = stats.get(member.id) ?? { income: 0, expense: 0, owedToOthers: 0, owedByOthers: 0 };
    const allowanceUsedPct =
      member.monthlyAllowance > 0 ? Math.round((s.expense / member.monthlyAllowance) * 100) : 0;
    return {
      member,
      income: Number(s.income.toFixed(2)),
      expense: Number(s.expense.toFixed(2)),
      net: Number((s.income - s.expense).toFixed(2)),
      allowanceUsedPct,
      splitOwedToOthers: Number(s.owedToOthers.toFixed(2)),
      splitOwedByOthers: Number(s.owedByOthers.toFixed(2)),
    };
  });
}

export function computeFinancialHealthScore(
  state: AppState,
  monthKey: string,
  language: AppLanguage = 'en'
): {
  score: number;
  grade: string;
  savingsRate: number;
  emergencyMonths: number;
  budgetAdherencePct: number;
  insights: string[];
} {
  const summary = computeMonthlySummary(state.transactions, monthKey, 'all');
  const catSpending = computeCategorySpending(state.transactions, state.categories, monthKey, 'expense');
  const budgeted = catSpending.filter((c) => c.budget > 0);
  const withinBudget = budgeted.filter((c) => c.spent <= c.budget).length;
  const budgetAdherencePct = budgeted.length > 0 ? Math.round((withinBudget / budgeted.length) * 100) : 100;

  const liquidBalance = state.accounts
    .filter((a) => a.type === 'checking' || a.type === 'savings' || a.type === 'cash')
    .reduce((sum, acc) => sum + Math.max(0, computeAccountBalance(acc, state.transactions)), 0);

  const avgMonthlyExpense = Math.max(summary.expense, 1500);
  const emergencyMonths = Number((liquidBalance / avgMonthlyExpense).toFixed(1));

  const savingsPoints = Math.min(35, Math.max(0, (summary.savingsRate / 30) * 35));
  const emergencyPoints = Math.min(35, Math.max(0, (emergencyMonths / 6) * 35));
  const budgetPoints = Math.min(30, (budgetAdherencePct / 100) * 30);

  const score = Math.round(savingsPoints + emergencyPoints + budgetPoints);
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'D';

  const insights: string[] = [];
  if (summary.savingsRate >= 20) {
    insights.push(
      language === 'gu'
        ? `મજબૂત બચત ગતિ: આ મહિને પરિવારની આવકના ${summary.savingsRate}% બચત થઈ છે.`
        : `Strong savings momentum: ${summary.savingsRate}% of household income retained this month.`
    );
  } else if (summary.income > 0) {
    insights.push(
      language === 'gu'
        ? `બચત દર ${summary.savingsRate}% છે — બિનજરૂરી ખર્ચ ઘટાડીને 20% તરફ લઈ જઈ શકાય.`
        : `Savings rate is ${summary.savingsRate}% — trimming top discretionary wants could lift it toward 20%.`
    );
  }

  const overBudget = budgeted.filter((c) => c.spent > c.budget);
  if (overBudget.length > 0) {
    const topOverName = localizeCategoryName(overBudget[0].category, language);
    insights.push(
      language === 'gu'
        ? `${overBudget.length} બજેટ શ્રેણી મર્યાદાથી બહાર છે (${topOverName} ${overBudget[0].percentage}% પર છે).`
        : `${overBudget.length} budget ${overBudget.length === 1 ? 'category is' : 'categories are'} over limit (${overBudget[0].category.name} at ${overBudget[0].percentage}%).`
    );
  } else if (budgeted.length > 0) {
    insights.push(
      language === 'gu'
        ? 'બધી બજેટ કરેલી ખર્ચ શ્રેણીઓ હાલમાં માસિક મર્યાદામાં છે.'
        : 'Every budgeted spending category is currently within its monthly target.'
    );
  }

  if (emergencyMonths >= 6) {
    insights.push(
      language === 'gu'
        ? `રોકડ અનામત ભંડોળ આશરે ${emergencyMonths} મહિનાના પરિવાર ખર્ચ માટે પૂરતું છે.`
        : `Liquid reserves cover ~${emergencyMonths} months of household expenses.`
    );
  } else {
    insights.push(
      language === 'gu'
        ? `રોકડ અનામત ~${emergencyMonths} મહિના ચાલે તેમ છે; 6-મહિનાનું કટોકટી ભંડોળ સુરક્ષા વધારશે.`
        : `Liquid reserves cover ~${emergencyMonths} months; building toward a 6-month buffer adds resilience.`
    );
  }

  return {
    score,
    grade,
    savingsRate: summary.savingsRate,
    emergencyMonths,
    budgetAdherencePct,
    insights,
  };
}

export function goalMonthlyContributionNeeded(goal: SavingsGoal, referenceDate = todayISO()): number {
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  if (remaining === 0) return 0;
  const start = new Date(referenceDate);
  const end = new Date(goal.targetDate);
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (months <= 0) return Number(remaining.toFixed(2));
  return Number((remaining / months).toFixed(2));
}

export function debtPayoffMonths(debt: DebtItem): number | null {
  if (debt.currentBalance <= 0) return 0;
  if (debt.minimumPayment <= 0) return null;
  const monthlyRate = debt.interestRateApr / 100 / 12;
  if (monthlyRate === 0) {
    return Math.ceil(debt.currentBalance / debt.minimumPayment);
  }
  const interestOnly = debt.currentBalance * monthlyRate;
  if (debt.minimumPayment <= interestOnly) return null;
  const months =
    -Math.log(1 - (monthlyRate * debt.currentBalance) / debt.minimumPayment) /
    Math.log(1 + monthlyRate);
  return Math.ceil(months);
}
