import type {
  Account,
  ActivityEntry,
  AppSettings,
  AppState,
  Category,
  CsvPreset,
  DebtItem,
  FamilyMember,
  EmergencyVaultMeta,
  InsurancePolicy,
  InvestmentHolding,
  MerchantRule,
  RecurringRule,
  SavingsGoal,
  SipPlan,
  Transaction,
} from '../types/finance';
import { createSeedState } from '../data/seed';
import { applyRulesToTransactions, runDueAutoPost } from '../utils/automation';
import { advanceDateByFrequency, todayISO } from '../utils/calculations';
import { convertCurrency } from '../utils/currency';

export type FinanceAction =
  | { type: 'HYDRATE_STATE'; payload: AppState }
  | { type: 'ADD_TRANSACTION'; payload: Transaction }
  | { type: 'UPDATE_TRANSACTION'; id: string; patch: Partial<Transaction> }
  | { type: 'MARK_TRANSACTIONS_STATUS'; ids: string[]; status: Transaction['status'] }
  | { type: 'DELETE_TRANSACTIONS'; ids: string[] }
  | { type: 'IMPORT_TRANSACTIONS'; payload: Transaction[] }
  | {
      type: 'ATTACH_RECEIPT_META';
      txId: string;
      receiptId: string;
      receiptName: string;
      receiptSizeBytes: number;
    }
  | { type: 'REMOVE_RECEIPT_META'; txId: string }
  | { type: 'SETTLE_MEMBER_SPLIT'; txId: string; memberId: string }
  | {
      type: 'SETTLE_MEMBER_PAIR_IOUS';
      fromMemberId: string;
      toMemberId: string;
      settlementTx?: Transaction;
    }
  | { type: 'UPSERT_MEMBER'; payload: FamilyMember }
  | { type: 'DELETE_MEMBER'; id: string }
  | { type: 'UPSERT_ACCOUNT'; payload: Account }
  | { type: 'DELETE_ACCOUNT'; id: string }
  | { type: 'UPSERT_CATEGORY'; payload: Category }
  | { type: 'DELETE_CATEGORY'; id: string }
  | { type: 'UPSERT_RECURRING'; payload: RecurringRule }
  | { type: 'DELETE_RECURRING'; id: string }
  | { type: 'POST_RECURRING_DUE'; ruleId: string; postedTxId: string; createdAt: string }
  | { type: 'UPSERT_GOAL'; payload: SavingsGoal }
  | {
      type: 'CONTRIBUTE_GOAL';
      goalId: string;
      amount: number;
      fromAccountId: string;
      memberId: string;
      txId: string;
      date: string;
      createdAt: string;
    }
  | { type: 'DELETE_GOAL'; id: string }
  | { type: 'UPSERT_DEBT'; payload: DebtItem }
  | {
      type: 'RECORD_DEBT_PAYMENT';
      debtId: string;
      amount: number;
      fromAccountId: string;
      memberId: string;
      txId: string;
      date: string;
      createdAt: string;
    }
  | { type: 'DELETE_DEBT'; id: string }
  | { type: 'UPSERT_RULE'; payload: MerchantRule }
  | { type: 'DELETE_RULE'; id: string }
  | { type: 'UPSERT_INVESTMENT'; payload: InvestmentHolding }
  | { type: 'DELETE_INVESTMENT'; id: string }
  | { type: 'UPSERT_SIP'; payload: SipPlan }
  | { type: 'DELETE_SIP'; id: string }
  | {
      type: 'EXECUTE_SIP_INSTALLMENT';
      sipId: string;
      txId: string;
      date: string;
      createdAt: string;
    }
  | { type: 'UPSERT_POLICY'; payload: InsurancePolicy }
  | { type: 'DELETE_POLICY'; id: string }
  | { type: 'UPDATE_EMERGENCY_INFO'; payload: EmergencyVaultMeta }
  | { type: 'APPLY_RULES_TO_EXISTING' }
  | { type: 'RUN_DUE_AUTOPOST'; asOfDate?: string }
  | { type: 'UPSERT_CSV_PRESET'; payload: CsvPreset }
  | { type: 'DELETE_CSV_PRESET'; id: string }
  | { type: 'APPEND_AUDIT_LOG'; entry: ActivityEntry }
  | { type: 'REPLACE_AUDIT_LOG'; entries: ActivityEntry[] }
  | { type: 'UPDATE_SETTINGS'; patch: Partial<AppSettings> }
  | { type: 'SET_PIN_CREDS'; pinHash: string; pinSalt: string }
  | { type: 'DISABLE_PIN' }
  | { type: 'RESTORE_STATE'; payload: AppState }
  | { type: 'RESET_TO_DEMO' }
  | { type: 'CLEAR_ALL_DATA' };

export function upsertById<T extends { id: string }>(items: T[], nextItem: T): T[] {
  const exists = items.some((item) => item.id === nextItem.id);
  return exists
    ? items.map((item) => (item.id === nextItem.id ? nextItem : item))
    : [...items, nextItem];
}

export function deleteById<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((item) => item.id !== id);
}

/**
 * Pure domain reducer for HearthLedger household state transitions.
 */
export function financeReducer(state: AppState, action: FinanceAction): AppState {
  switch (action.type) {
    case 'HYDRATE_STATE':
    case 'RESTORE_STATE':
      return action.payload;

    case 'RESET_TO_DEMO':
      return createSeedState();

    case 'CLEAR_ALL_DATA':
      return {
        ...state,
        transactions: [],
        recurring: [],
        goals: [],
        debts: [],
        accounts: state.accounts.map((a) => ({ ...a, initialBalance: 0 })),
      };

    case 'ADD_TRANSACTION': {
      const baseAmount = convertCurrency(
        action.payload.amount,
        action.payload.currency,
        state.settings.baseCurrency,
        state.settings.exchangeRates
      );
      return {
        ...state,
        transactions: [{ ...action.payload, baseAmount }, ...state.transactions],
      };
    }

    case 'UPDATE_TRANSACTION':
      return {
        ...state,
        transactions: state.transactions.map((tx) => {
          if (tx.id !== action.id) return tx;
          const merged: Transaction = { ...tx, ...action.patch };
          merged.baseAmount = convertCurrency(
            merged.amount,
            merged.currency,
            state.settings.baseCurrency,
            state.settings.exchangeRates
          );
          return merged;
        }),
      };

    case 'DELETE_TRANSACTIONS': {
      const idSet = new Set(action.ids);
      return {
        ...state,
        transactions: state.transactions.filter((tx) => !idSet.has(tx.id)),
      };
    }

    case 'MARK_TRANSACTIONS_STATUS': {
      const idSet = new Set(action.ids);
      return {
        ...state,
        transactions: state.transactions.map((tx) =>
          idSet.has(tx.id) ? { ...tx, status: action.status } : tx
        ),
      };
    }

    case 'IMPORT_TRANSACTIONS':
      return {
        ...state,
        transactions: [...action.payload, ...state.transactions],
      };

    case 'ATTACH_RECEIPT_META':
      return {
        ...state,
        transactions: state.transactions.map((tx) =>
          tx.id === action.txId
            ? {
                ...tx,
                receiptId: action.receiptId,
                receiptName: action.receiptName,
                receiptSizeBytes: action.receiptSizeBytes,
              }
            : tx
        ),
      };

    case 'REMOVE_RECEIPT_META':
      return {
        ...state,
        transactions: state.transactions.map((tx) =>
          tx.id === action.txId
            ? {
                ...tx,
                receiptId: undefined,
                receiptName: undefined,
                receiptSizeBytes: undefined,
              }
            : tx
        ),
      };

    case 'SETTLE_MEMBER_SPLIT':
      return {
        ...state,
        transactions: state.transactions.map((tx) => {
          if (tx.id !== action.txId || !tx.memberSplits) return tx;
          return {
            ...tx,
            memberSplits: tx.memberSplits.map((sp) =>
              sp.memberId === action.memberId ? { ...sp, settled: !sp.settled } : sp
            ),
          };
        }),
      };

    case 'SETTLE_MEMBER_PAIR_IOUS': {
      const updated = state.transactions.map((tx) => {
        if (tx.type !== 'expense' || !tx.memberSplits) return tx;
        const isPairPayer =
          tx.memberId === action.fromMemberId || tx.memberId === action.toMemberId;
        if (!isPairPayer) return tx;
        const otherId =
          tx.memberId === action.fromMemberId ? action.toMemberId : action.fromMemberId;
        return {
          ...tx,
          memberSplits: tx.memberSplits.map((sp) =>
            sp.memberId === otherId ? { ...sp, settled: true } : sp
          ),
        };
      });
      return {
        ...state,
        transactions: action.settlementTx ? [action.settlementTx, ...updated] : updated,
      };
    }

    case 'UPSERT_MEMBER':
      return { ...state, members: upsertById(state.members, action.payload) };
    case 'DELETE_MEMBER':
      return { ...state, members: deleteById(state.members, action.id) };

    case 'UPSERT_ACCOUNT':
      return { ...state, accounts: upsertById(state.accounts, action.payload) };
    case 'DELETE_ACCOUNT':
      return { ...state, accounts: deleteById(state.accounts, action.id) };

    case 'UPSERT_CATEGORY':
      return { ...state, categories: upsertById(state.categories, action.payload) };
    case 'DELETE_CATEGORY':
      return { ...state, categories: deleteById(state.categories, action.id) };

    case 'UPSERT_RECURRING':
      return { ...state, recurring: upsertById(state.recurring, action.payload) };
    case 'DELETE_RECURRING':
      return { ...state, recurring: deleteById(state.recurring, action.id) };

    case 'POST_RECURRING_DUE': {
      const rule = state.recurring.find((r) => r.id === action.ruleId);
      if (!rule) return state;
      const baseAmount = convertCurrency(
        rule.amount,
        rule.currency,
        state.settings.baseCurrency,
        state.settings.exchangeRates
      );
      const postedTx: Transaction = {
        id: action.postedTxId,
        type: rule.type,
        amount: rule.amount,
        currency: rule.currency,
        baseAmount,
        date: rule.nextDueDate,
        merchant: rule.title,
        categoryId: rule.categoryId,
        accountId: rule.accountId,
        toAccountId: rule.toAccountId,
        memberId: rule.memberId,
        tags: ['recurring'],
        note: `Auto-posted from recurring schedule (${rule.frequency})`,
        status: 'cleared',
        recurringId: rule.id,
        createdAt: action.createdAt,
      };
      return {
        ...state,
        transactions: [postedTx, ...state.transactions],
        recurring: state.recurring.map((r) =>
          r.id === action.ruleId
            ? {
                ...r,
                lastPostedDate: r.nextDueDate,
                nextDueDate: advanceDateByFrequency(r.nextDueDate, r.frequency),
              }
            : r
        ),
      };
    }

    case 'UPSERT_GOAL':
      return { ...state, goals: upsertById(state.goals, action.payload) };
    case 'DELETE_GOAL':
      return { ...state, goals: deleteById(state.goals, action.id) };

    case 'CONTRIBUTE_GOAL': {
      const goal = state.goals.find((g) => g.id === action.goalId);
      if (!goal || action.amount <= 0) return state;
      const isTransfer = Boolean(
        goal.linkedAccountId && goal.linkedAccountId !== action.fromAccountId
      );
      const newTx: Transaction = {
        id: action.txId,
        type: isTransfer ? 'transfer' : 'expense',
        amount: action.amount,
        currency: state.settings.baseCurrency,
        baseAmount: action.amount,
        date: action.date || todayISO(),
        merchant: `Goal: ${goal.name}`,
        categoryId: 'cat-savings-tx',
        accountId: action.fromAccountId,
        toAccountId: isTransfer ? goal.linkedAccountId : undefined,
        memberId: action.memberId,
        tags: ['goal-contribution'],
        note: `Contribution toward ${goal.name}`,
        status: 'cleared',
        createdAt: action.createdAt,
      };
      return {
        ...state,
        transactions: [newTx, ...state.transactions],
        goals: state.goals.map((g) =>
          g.id === action.goalId
            ? { ...g, currentAmount: Number((g.currentAmount + action.amount).toFixed(2)) }
            : g
        ),
      };
    }

    case 'UPSERT_DEBT':
      return { ...state, debts: upsertById(state.debts, action.payload) };
    case 'DELETE_DEBT':
      return { ...state, debts: deleteById(state.debts, action.id) };

    case 'RECORD_DEBT_PAYMENT': {
      const debt = state.debts.find((d) => d.id === action.debtId);
      if (!debt || action.amount <= 0) return state;
      const newTx: Transaction = {
        id: action.txId,
        type: 'expense',
        amount: action.amount,
        currency: state.settings.baseCurrency,
        baseAmount: action.amount,
        date: action.date || todayISO(),
        merchant: `Debt Payment: ${debt.name}`,
        categoryId: 'cat-housing',
        accountId: action.fromAccountId,
        memberId: action.memberId,
        tags: ['debt-payoff'],
        note: `Payment to ${debt.lender}`,
        status: 'cleared',
        createdAt: action.createdAt,
      };
      return {
        ...state,
        transactions: [newTx, ...state.transactions],
        debts: state.debts.map((d) =>
          d.id === action.debtId
            ? {
                ...d,
                currentBalance: Math.max(0, Number((d.currentBalance - action.amount).toFixed(2))),
              }
            : d
        ),
      };
    }

    case 'UPDATE_SETTINGS': {
      const nextSettings = { ...state.settings, ...action.patch };
      const shouldRebase =
        action.patch.baseCurrency !== undefined || action.patch.exchangeRates !== undefined;
      const transactions = shouldRebase
        ? state.transactions.map((tx) => ({
            ...tx,
            baseAmount: convertCurrency(
              tx.amount,
              tx.currency,
              nextSettings.baseCurrency,
              nextSettings.exchangeRates
            ),
          }))
        : state.transactions;
      return {
        ...state,
        settings: nextSettings,
        transactions,
      };
    }

    case 'SET_PIN_CREDS': {
      const nextSettings = {
        ...state.settings,
        pinEnabled: true,
        pinHash: action.pinHash,
        pinSalt: action.pinSalt,
      };
      delete nextSettings.pinCode;
      return { ...state, settings: nextSettings };
    }

    case 'DISABLE_PIN': {
      const nextSettings = { ...state.settings, pinEnabled: false };
      delete nextSettings.pinHash;
      delete nextSettings.pinSalt;
      delete nextSettings.pinCode;
      return { ...state, settings: nextSettings };
    }

    case 'UPSERT_RULE':
      return { ...state, rules: upsertById(state.rules ?? [], action.payload) };
    case 'DELETE_RULE':
      return { ...state, rules: deleteById(state.rules ?? [], action.id) };

    case 'UPSERT_INVESTMENT':
      return {
        ...state,
        investments: upsertById(state.investments ?? [], action.payload),
      };
    case 'DELETE_INVESTMENT':
      return {
        ...state,
        investments: deleteById(state.investments ?? [], action.id),
      };

    case 'UPSERT_SIP':
      return { ...state, sips: upsertById(state.sips ?? [], action.payload) };
    case 'DELETE_SIP':
      return { ...state, sips: deleteById(state.sips ?? [], action.id) };

    case 'EXECUTE_SIP_INSTALLMENT': {
      const sip = (state.sips ?? []).find((s) => s.id === action.sipId);
      if (!sip || sip.monthlyAmount <= 0) return state;
      const sourceAcc = state.accounts.find((a) => a.id === sip.accountId);
      const sipCurrency = sourceAcc?.currency ?? state.settings.baseCurrency;
      const baseAmount = convertCurrency(
        sip.monthlyAmount,
        sipCurrency,
        state.settings.baseCurrency,
        state.settings.exchangeRates
      );
      const isTransfer = Boolean(sip.targetAccountId && sip.targetAccountId !== sip.accountId);
      const sipTx: Transaction = {
        id: action.txId,
        type: isTransfer ? 'transfer' : 'expense',
        amount: sip.monthlyAmount,
        currency: sipCurrency,
        baseAmount,
        date: action.date || todayISO(),
        merchant: `SIP: ${sip.name}`,
        categoryId: 'cat-savings-tx',
        accountId: sip.accountId,
        toAccountId: isTransfer ? sip.targetAccountId : undefined,
        memberId: sip.memberId,
        tags: ['sip', 'investment'],
        note: `Systematic Investment Plan installment`,
        status: 'cleared',
        createdAt: action.createdAt,
      };
      const nextInvestments = (state.investments ?? []).map((inv) => {
        if (inv.id !== sip.holdingId || inv.currentPricePerUnit <= 0) return inv;
        const addedUnits = sip.monthlyAmount / inv.currentPricePerUnit;
        const prevCostTotal = inv.units * inv.avgCostPerUnit;
        const nextUnits = Number((inv.units + addedUnits).toFixed(4));
        const nextAvgCost =
          nextUnits > 0 ? Number(((prevCostTotal + sip.monthlyAmount) / nextUnits).toFixed(2)) : inv.avgCostPerUnit;
        return {
          ...inv,
          units: nextUnits,
          avgCostPerUnit: nextAvgCost,
        };
      });
      return {
        ...state,
        transactions: [sipTx, ...state.transactions],
        investments: nextInvestments,
        sips: (state.sips ?? []).map((s) =>
          s.id === action.sipId ? { ...s, lastInvestedDate: action.date || todayISO() } : s
        ),
      };
    }

    case 'UPSERT_POLICY':
      return { ...state, policies: upsertById(state.policies ?? [], action.payload) };
    case 'DELETE_POLICY':
      return { ...state, policies: deleteById(state.policies ?? [], action.id) };
    case 'UPDATE_EMERGENCY_INFO':
      return { ...state, emergencyInfo: action.payload };

    case 'APPLY_RULES_TO_EXISTING': {
      const { transactions } = applyRulesToTransactions(state.transactions, state.rules ?? []);
      return { ...state, transactions };
    }

    case 'RUN_DUE_AUTOPOST': {
      const { nextState } = runDueAutoPost(state, action.asOfDate);
      return nextState;
    }

    case 'UPSERT_CSV_PRESET':
      return {
        ...state,
        settings: {
          ...state.settings,
          csvPresets: upsertById(state.settings.csvPresets ?? [], action.payload),
        },
      };

    case 'DELETE_CSV_PRESET':
      return {
        ...state,
        settings: {
          ...state.settings,
          csvPresets: deleteById(state.settings.csvPresets ?? [], action.id),
        },
      };

    case 'APPEND_AUDIT_LOG':
      return {
        ...state,
        auditLog: [action.entry, ...(state.auditLog ?? [])].slice(0, 100),
      };

    case 'REPLACE_AUDIT_LOG':
      return {
        ...state,
        auditLog: action.entries.slice(0, 100),
      };

    default:
      return state;
  }
}
