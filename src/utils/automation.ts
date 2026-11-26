import type { AppLanguage, AppState, MerchantRule, Transaction } from '../types/finance';
import { localizeCategoryName, localizeEntityText } from '../i18n/localize';
import {
  advanceDateByFrequency,
  computeCategorySpending,
  shiftMonth,
  todayISO,
} from './calculations';
import { convertCurrency } from './currency';

/**
 * Matches a merchant description against active user-defined rules.
 * Precedence follows rule priority: exact -> startsWith -> contains.
 */
export function matchMerchantRule(
  merchant: string,
  rules: MerchantRule[]
): MerchantRule | null {
  const normalized = merchant.trim().toLowerCase();
  if (!normalized) return null;

  const active = rules.filter((r) => r.isActive && r.pattern.trim().length > 0);
  const byType = (type: MerchantRule['matchType']) =>
    active.filter((r) => r.matchType === type);

  for (const r of byType('exact')) {
    if (normalized === r.pattern.trim().toLowerCase()) return r;
  }
  for (const r of byType('startsWith')) {
    if (normalized.startsWith(r.pattern.trim().toLowerCase())) return r;
  }
  for (const r of byType('contains')) {
    if (normalized.includes(r.pattern.trim().toLowerCase())) return r;
  }
  return null;
}

/**
 * Applies active merchant categorization rules across existing transactions.
 */
export function applyRulesToTransactions(
  transactions: Transaction[],
  rules: MerchantRule[]
): { transactions: Transaction[]; updatedCount: number } {
  let updatedCount = 0;
  const next = transactions.map((tx) => {
    if (tx.type === 'transfer') return tx;
    const rule = matchMerchantRule(tx.merchant, rules);
    if (!rule) return tx;

    const mergedTags = Array.from(new Set([...tx.tags, ...(rule.tags ?? [])]));
    const nextMemberId = rule.memberId ?? tx.memberId;
    const changed =
      tx.categoryId !== rule.categoryId ||
      tx.memberId !== nextMemberId ||
      mergedTags.length !== tx.tags.length;

    if (!changed) return tx;
    updatedCount++;
    return {
      ...tx,
      categoryId: rule.categoryId,
      memberId: nextMemberId,
      tags: mergedTags,
    };
  });

  return { transactions: next, updatedCount };
}

/**
 * Idempotently posts any active recurring schedules with `autoPost: true`
 * whose `nextDueDate <= asOfDate`, advancing `nextDueDate` cleanly.
 * Capped at 12 periods per rule per run to prevent runaway catch-ups.
 */
export function runDueAutoPost(
  state: AppState,
  asOfDate = todayISO()
): { nextState: AppState; postedCount: number; postedTitles: string[] } {
  const existingKeys = new Set(
    state.transactions
      .filter((tx) => tx.recurringId)
      .map((tx) => `${tx.recurringId}::${tx.date}`)
  );

  const newTransactions: Transaction[] = [];
  const postedTitles: string[] = [];

  const updatedRecurring = state.recurring.map((rule) => {
    if (!rule.isActive || !rule.autoPost) return rule;
    let cursor = rule;
    let guard = 0;

    while (cursor.nextDueDate <= asOfDate && guard < 12) {
      guard++;
      const dedupeKey = `${cursor.id}::${cursor.nextDueDate}`;
      if (cursor.lastPostedDate !== cursor.nextDueDate && !existingKeys.has(dedupeKey)) {
        existingKeys.add(dedupeKey);
        const baseAmount = convertCurrency(
          cursor.amount,
          cursor.currency,
          state.settings.baseCurrency,
          state.settings.exchangeRates
        );
        newTransactions.push({
          id: `tx-auto-${cursor.id}-${cursor.nextDueDate}-${guard}`,
          type: cursor.type,
          amount: cursor.amount,
          currency: cursor.currency,
          baseAmount,
          date: cursor.nextDueDate,
          merchant: cursor.title,
          categoryId: cursor.categoryId,
          accountId: cursor.accountId,
          toAccountId: cursor.toAccountId,
          memberId: cursor.memberId,
          tags: ['recurring', 'autopost'],
          note: `Auto-posted from recurring schedule (${cursor.frequency})`,
          status: 'cleared',
          recurringId: cursor.id,
          createdAt: new Date().toISOString(),
        });
        postedTitles.push(cursor.title);
      }

      const nextDate = advanceDateByFrequency(cursor.nextDueDate, cursor.frequency);
      if (nextDate === cursor.nextDueDate) break;
      cursor = {
        ...cursor,
        lastPostedDate: cursor.nextDueDate,
        nextDueDate: nextDate,
      };
    }

    return cursor;
  });

  if (newTransactions.length === 0) {
    return { nextState: state, postedCount: 0, postedTitles: [] };
  }

  return {
    nextState: {
      ...state,
      transactions: [...newTransactions, ...state.transactions],
      recurring: updatedRecurring,
    },
    postedCount: newTransactions.length,
    postedTitles: Array.from(new Set(postedTitles)),
  };
}

export interface FinancialAlert {
  id: string;
  severity: 'warning' | 'info';
  kind: 'price-hike' | 'spend-spike' | 'bill-due';
  title: string;
  detail: string;
}

/**
 * Analyzes recurring price hikes, category spending spikes vs trailing 3-month average,
 * and overdue manual recurring bills.
 */
export function detectFinancialAnomalies(
  state: AppState,
  monthKey: string,
  asOfDate = todayISO(),
  language: AppLanguage = 'en'
): FinancialAlert[] {
  const alerts: FinancialAlert[] = [];

  // 1. Recurring price hike detection: compare active expense rule amount against prior posted history
  for (const rule of state.recurring) {
    if (!rule.isActive || rule.type !== 'expense') continue;

    const history = state.transactions
      .filter(
        (tx) =>
          tx.type === 'expense' &&
          (tx.recurringId === rule.id ||
            tx.merchant.toLowerCase() === rule.title.toLowerCase())
      )
      .sort((a, b) => b.date.localeCompare(a.date));

    if (history.length >= 1) {
      const priorAvg = history.reduce((s, tx) => s + tx.amount, 0) / history.length;
      if (priorAvg > 0 && rule.amount > priorAvg * 1.05) {
        const pct = Math.round(((rule.amount - priorAvg) / priorAvg) * 100);
        const localizedTitle = localizeEntityText(rule.title, language);
        alerts.push({
          id: `hike-rule-${rule.id}`,
          severity: 'warning',
          kind: 'price-hike',
          title:
            language === 'gu'
              ? `નિયમિત રકમમાં વધારો: ${localizedTitle}`
              : `Recurring increase: ${rule.title}`,
          detail:
            language === 'gu'
              ? `નિયત રકમ અગાઉની સરેરાશ (${priorAvg.toFixed(2)}) કરતાં ${pct}% વધારે છે.`
              : `Scheduled amount is ${pct}% above historical average (${priorAvg.toFixed(2)}).`,
        });
      }
    }

    // Overdue manual bills
    if (!rule.autoPost && rule.nextDueDate <= asOfDate) {
      const localizedTitle = localizeEntityText(rule.title, language);
      alerts.push({
        id: `due-${rule.id}`,
        severity: 'info',
        kind: 'bill-due',
        title:
          language === 'gu' ? `બિલ ચુકવણી બાકી: ${localizedTitle}` : `Bill due: ${rule.title}`,
        detail:
          language === 'gu'
            ? `ચુકવણી તારીખ: ${rule.nextDueDate}. ચૂકવ્યા પછી નિયમિત બિલ વિભાગમાંથી નોંધો.`
            : `Due on ${rule.nextDueDate}. Post it from Recurring & Bills when paid.`,
      });
    }
  }

  // 2. Category spend spike detection vs trailing 3 months
  const currentCat = computeCategorySpending(
    state.transactions,
    state.categories,
    monthKey,
    'expense',
    'all'
  );
  const trailingMaps = [-1, -2, -3].map((offset) => {
    const m = shiftMonth(monthKey, offset);
    return new Map(
      computeCategorySpending(state.transactions, state.categories, m, 'expense', 'all').map(
        (c) => [c.category.id, c.spent]
      )
    );
  });

  for (const item of currentCat) {
    if (item.spent < 75) continue;
    const prevVals = trailingMaps
      .map((m) => m.get(item.category.id) ?? 0)
      .filter((v) => v > 0);
    if (prevVals.length === 0) continue;
    const avg = prevVals.reduce((s, v) => s + v, 0) / prevVals.length;
    if (avg > 0 && item.spent > avg * 1.25 && item.spent - avg >= 50) {
      const pct = Math.round(((item.spent - avg) / avg) * 100);
      const catLabel = localizeCategoryName(item.category, language);
      alerts.push({
        id: `spike-${item.category.id}`,
        severity: 'warning',
        kind: 'spend-spike',
        title:
          language === 'gu'
            ? `વધારાનો ખર્ચ: ${item.category.icon} ${catLabel}`
            : `Spend spike in ${item.category.icon} ${item.category.name}`,
        detail:
          language === 'gu'
            ? `છેલ્લા ${prevVals.length} મહિનાની સરેરાશ કરતાં ${pct}% વધુ ખર્ચ.`
            : `Up ${pct}% vs your trailing ${prevVals.length}-month average.`,
      });
    }
  }

  return alerts;
}
