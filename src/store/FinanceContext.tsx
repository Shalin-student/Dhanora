import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import type {
  Account,
  AccountRole,
  ActiveView,
  ActivityEntry,
  ActivityEntityType,
  AppLanguage,
  AppSettings,
  AppState,
  AuthSession,
  Category,
  CsvPreset,
  CurrencyCode,
  DebtItem,
  EmergencyVaultMeta,
  FamilyMember,
  InsurancePolicy,
  InvestmentHolding,
  MerchantRule,
  PlanTier,
  ReceiptRecord,
  RecurringRule,
  SavingsGoal,
  SipPlan,
  Transaction,
} from '../types/finance';
import { createCleanHouseholdSeed, createSeedState } from '../data/seed';
import { applyRulesToTransactions, runDueAutoPost } from '../utils/automation';
import {
  createGuestDemoSession,
  deleteAccountFromServer,
  DEMO_HOUSEHOLD_ID,
  loadAuthSession,
  logoutFromServer,
  persistAuthSession,
  signInAccount,
  signUpAccount,
} from '../utils/auth';
import { todayISO } from '../utils/calculations';
import { estimateDataUrlBytes } from '../utils/image';
import {
  getRoleCapabilities,
  isViewAllowedForRole,
  type RoleCapabilities,
} from '../utils/permissions';
import { createPinCredentials, verifyPinAgainstSettings } from '../utils/security';
import {
  localizeAccountName,
  localizeMemberName,
  localizeTxStatus,
  localizeTxType,
  translate,
  type TranslationKey,
} from '../i18n';
import { computeClearedAccountBalance } from '../utils/calculations';
import { convertCurrency } from '../utils/currency';
import { useAutoLock } from '../hooks/useAutoLock';
import { usePwaStatus } from '../hooks/usePwaStatus';
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts';
import { financeReducer } from './financeReducer';
import {
  clearAllReceiptRecords,
  deleteAppStateFromRepo,
  deleteReceiptRecord,
  getReceiptRecord,
  hasIndexedDb,
  LEGACY_LOCALSTORAGE_KEY,
  loadAppStateFromRepo,
  purgeOrphanReceipts,
  sanitizeAndMigrateState,
  saveAppStateToRepo,
  saveReceiptRecord,
} from '../storage/repository';
import {
  checkSyncHealth,
  deleteServerReceipt,
  fetchCurrentAuthSession,
  fetchServerReceipt,
  fetchServerState,
  pushServerReceipt,
  pushServerState,
  subscribeToSyncEvents,
  type SyncClientConfig,
} from '../storage/syncClient';

const SYNC_REVISION_KEY = 'hearthledger_sync_rev_v1';
const LANGUAGE_KEY = 'hearthledger_lang_v1';

export type SyncStatus = 'local-only' | 'connecting' | 'synced' | 'offline' | 'conflict';

export interface ToastMessage {
  id: string;
  message: string;
  undo?: () => void;
  onFinalize?: () => void;
}

function readCachedLanguage(): AppLanguage {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(LANGUAGE_KEY) : null;
    return saved === 'gu' ? 'gu' : 'en';
  } catch {
    return 'en';
  }
}

function loadSyncBootstrapState(session: AuthSession | null): AppState {
  const cachedLang = readCachedLanguage();
  const hhId = session?.householdId || (session?.isDemo ? DEMO_HOUSEHOLD_ID : 'default');
  const storageKey =
    hhId && hhId !== 'default' ? `${LEGACY_LOCALSTORAGE_KEY}:${hhId}` : LEGACY_LOCALSTORAGE_KEY;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && Array.isArray(parsed.transactions) && Array.isArray(parsed.accounts)) {
        const normalized: AppState = {
          ...parsed,
          rules: parsed.rules ?? [],
          investments: parsed.investments ?? [],
          sips: parsed.sips ?? [],
          policies: parsed.policies ?? [],
          emergencyInfo: parsed.emergencyInfo ?? {
            willLocation: '',
            bankLockerInfo: '',
            advisorContact: '',
            nomineeNotes: '',
          },
          auditLog: parsed.auditLog ?? [],
          settings: {
            ...parsed.settings,
            language: parsed.settings.language ?? cachedLang,
            planTier: parsed.settings.planTier ?? 'free',
            autoLockMinutes: parsed.settings.autoLockMinutes ?? 0,
            csvPresets: parsed.settings.csvPresets ?? [],
            syncEnabled: parsed.settings.syncEnabled ?? true,
          },
        };
        return runDueAutoPost(normalized).nextState;
      }
    }
  } catch {
    // ignore corrupted storage and fall back cleanly
  }

  if (session && !session.isDemo) {
    const clean = createCleanHouseholdSeed({
      memberId: session.memberId,
      name: session.name,
      role: session.role,
      avatar: session.avatar,
      householdName: session.householdName,
      planTier: session.planTier ?? 'free',
      language: cachedLang,
    });
    return clean;
  }

  const seed = createSeedState();
  return {
    ...seed,
    settings: {
      ...seed.settings,
      language: seed.settings.language ?? cachedLang,
    },
  };
}

function loadStoredSyncRevision(): number {
  try {
    const raw =
      typeof localStorage !== 'undefined' ? localStorage.getItem(SYNC_REVISION_KEY) : null;
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export interface FinanceContextValue {
  state: AppState;
  isStorageHydrated: boolean;
  storageEngine: 'indexeddb' | 'fallback';
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  selectedMemberId: string | 'all';
  setSelectedMemberId: (id: string | 'all') => void;
  // Authenticated user session & role auto-detected from Sign In / Sign Up
  authSession: AuthSession | null;
  activeProfile: FamilyMember;
  roleCapabilities: RoleCapabilities;
  getAuthSyncConfig: () => SyncClientConfig;
  signInWithCredentials: (
    email: string,
    password: string,
    redirectView?: ActiveView
  ) => Promise<{ ok: boolean; errorKey?: string }>;
  signUpWithAccount: (options: {
    name: string;
    email: string;
    password: string;
    role: AccountRole;
    planTier?: PlanTier;
    householdName?: string;
    inviteCode?: string;
    baseCurrency?: CurrencyCode;
    redirectView?: ActiveView;
  }) => Promise<{ ok: boolean; errorKey?: string }>;
  enterGuestDemo: (presetIndex?: number) => void;
  signOut: () => void;
  deleteHouseholdAccount: () => Promise<boolean>;
  upgradePlan: (tier: PlanTier, billingCycle?: 'monthly' | 'yearly') => void;
  refreshSessionFromServer: () => Promise<void>;
  dispatchStarterTemplate: (nextState: AppState) => void;
  // Multi-device SQLite sync state
  syncStatus: SyncStatus;
  syncRevision: number;
  lastSyncedAt: string | null;
  syncNow: (forcePush?: boolean) => Promise<void>;
  getReceiptWithSync: (receiptId: string) => Promise<ReceiptRecord | null>;
  // Modals
  isQuickAddOpen: boolean;
  openQuickAdd: (editingTx?: Transaction | null) => void;
  closeQuickAdd: () => void;
  editingTransaction: Transaction | null;
  receiptPreviewTxId: string | null;
  openReceiptPreview: (txId: string) => void;
  closeReceiptPreview: () => void;
  isCommandPaletteOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  // Auth / PIN lock
  isUnlocked: boolean;
  unlockApp: (pin: string) => Promise<boolean>;
  lockApp: () => void;
  setHouseholdPin: (newPin: string) => Promise<void>;
  disableHouseholdPin: () => void;
  // PWA & Toast state
  isOnline: boolean;
  canInstallPwa: boolean;
  triggerInstallPwa: () => Promise<void>;
  toasts: ToastMessage[];
  pushToast: (message: string, undo?: () => void, onFinalize?: () => void) => void;
  dismissToast: (id: string, runFinalize?: boolean) => void;
  // Mutations
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt' | 'baseAmount'>) => void;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  toggleTransactionStatus: (id: string) => void;
  markTransactionsStatus: (ids: string[], status: Transaction['status']) => void;
  deleteTransactions: (ids: string[]) => void;
  reconcileAccountBalance: (accountId: string, statementBalance: number) => void;
  importTransactions: (txs: Transaction[]) => void;
  attachReceiptToTransaction: (
    txId: string,
    receipt: { fileName: string; mimeType: string; dataUrl: string; sizeBytes: number }
  ) => Promise<void>;
  removeReceiptFromTransaction: (txId: string) => Promise<void>;
  settleMemberSplit: (txId: string, memberId: string) => void;
  settleMemberPairIous: (
    fromMemberId: string,
    toMemberId: string,
    amount: number,
    options?: { recordEntry?: boolean; accountId?: string }
  ) => void;
  upsertMember: (member: FamilyMember) => void;
  deleteMember: (id: string) => void;
  upsertAccount: (account: Account) => void;
  deleteAccount: (id: string) => void;
  upsertCategory: (category: Category) => void;
  deleteCategory: (id: string) => void;
  upsertRecurring: (rule: RecurringRule) => void;
  deleteRecurring: (id: string) => void;
  postRecurringDue: (ruleId: string) => void;
  upsertGoal: (goal: SavingsGoal) => void;
  contributeGoal: (goalId: string, amount: number, fromAccountId: string, memberId: string) => void;
  deleteGoal: (id: string) => void;
  upsertDebt: (debt: DebtItem) => void;
  recordDebtPayment: (debtId: string, amount: number, fromAccountId: string, memberId: string) => void;
  deleteDebt: (id: string) => void;
  upsertRule: (rule: MerchantRule) => void;
  deleteRule: (id: string) => void;
  upsertInvestment: (holding: InvestmentHolding) => void;
  deleteInvestment: (id: string) => void;
  upsertSip: (sip: SipPlan) => void;
  deleteSip: (id: string) => void;
  recordSipInstallment: (sipId: string) => void;
  upsertPolicy: (policy: InsurancePolicy) => void;
  deletePolicy: (id: string) => void;
  updateEmergencyInfo: (info: EmergencyVaultMeta) => void;
  applyRulesToExistingTransactions: () => number;
  runAutoPostNow: () => number;
  upsertCsvPreset: (preset: CsvPreset) => void;
  deleteCsvPreset: (id: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  restoreState: (nextState: AppState, receiptsToRestore?: ReceiptRecord[]) => Promise<void>;
  resetToDemo: () => void;
  clearAllData: () => void;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [initialAuth] = useState<AuthSession | null>(() => loadAuthSession());
  const [state, dispatch] = useReducer(financeReducer, initialAuth, loadSyncBootstrapState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [isStorageHydrated, setIsStorageHydrated] = useState<boolean>(() => !hasIndexedDb());
  const isHydratedRef = useRef(!hasIndexedDb());
  const hasMutatedBeforeHydrationRef = useRef(false);
  const storageEngine: 'indexeddb' | 'fallback' = hasIndexedDb() ? 'indexeddb' : 'fallback';

  const [authSession, setAuthSession] = useState<AuthSession | null>(initialAuth);
  const authSessionRef = useRef(authSession);
  authSessionRef.current = authSession;
  const activeProfile = useMemo<FamilyMember>(() => {
    if (authSession) {
      const existing = state.members.find((m) => m.id === authSession.memberId);
      if (existing) {
        return { ...existing, role: authSession.role };
      }
      return {
        id: authSession.memberId,
        name: authSession.name,
        role: authSession.role,
        avatar: authSession.avatar,
        color: authSession.role === 'advisor' ? '#0ea5e9' : '#2563eb',
        monthlyAllowance: authSession.role === 'dependent' ? 250 : 1500,
      };
    }
    return (
      state.members.find((m) => m.role === 'admin') ??
      state.members[0] ?? {
        id: 'm-admin',
        name: 'Admin',
        role: 'admin',
        avatar: '🧑🏽‍💻',
        color: '#2563eb',
        monthlyAllowance: 0,
      }
    );
  }, [authSession, state.members]);
  const activeProfileRef = useRef(activeProfile);
  activeProfileRef.current = activeProfile;

  const roleCapabilities = useMemo(
    () => getRoleCapabilities(activeProfile.role),
    [activeProfile.role]
  );

  const [activeView, setRawActiveView] = useState<ActiveView>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => todayISO().slice(0, 7));
  const [rawSelectedMemberId, setRawSelectedMemberId] = useState<string | 'all'>(() =>
    authSession?.role === 'dependent' ? authSession.memberId : 'all'
  );
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [receiptPreviewTxId, setReceiptPreviewTxId] = useState<string | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => !state.settings.pinEnabled);

  // Sync status
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local-only');
  const syncStatusRef = useRef(syncStatus);
  syncStatusRef.current = syncStatus;
  const [syncRevision, setSyncRevision] = useState<number>(loadStoredSyncRevision);
  const syncRevisionRef = useRef(syncRevision);
  syncRevisionRef.current = syncRevision;
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const clientIdRef = useRef(`tab-${Math.random().toString(36).slice(2, 9)}`);
  const suppressNextPushRef = useRef(false);
  const pendingAuditRef = useRef<{
    action: string;
    summary: string;
    entityType: ActivityEntityType;
  } | null>(null);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastTimersRef = useRef<Map<string, number>>(new Map());
  const toastFinalizeRef = useRef<Map<string, () => void>>(new Map());

  const dismissToast = useCallback((id: string, runFinalize = true) => {
    const timer = toastTimersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    const finalize = toastFinalizeRef.current.get(id);
    toastFinalizeRef.current.delete(id);
    if (runFinalize) {
      finalize?.();
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (message: string, undo?: () => void, onFinalize?: () => void) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      if (onFinalize) {
        toastFinalizeRef.current.set(id, onFinalize);
      }
      setToasts((prev) => [...prev.slice(-2), { id, message, undo, onFinalize }]);
      const timer = window.setTimeout(() => {
        dismissToast(id, true);
      }, 6000);
      toastTimersRef.current.set(id, timer);
    },
    [dismissToast]
  );

  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      timers.clear();
    };
  }, []);

  const tr = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) =>
      translate(stateRef.current.settings.language ?? 'en', key, vars),
    []
  );

  const onInstalledToast = useCallback(() => {
    pushToast(tr('toast.installed'));
  }, [pushToast, tr]);

  const { isOnline, canInstallPwa, triggerInstallPwa } = usePwaStatus(onInstalledToast);

  const lockApp = useCallback(() => {
    if (stateRef.current.settings.pinEnabled) setIsUnlocked(false);
  }, []);

  useAutoLock(state.settings.pinEnabled, state.settings.autoLockMinutes, isUnlocked, lockApp);

  // Enforce role view permissions
  const setActiveView = useCallback(
    (view: ActiveView) => {
      if (isViewAllowedForRole(view, activeProfileRef.current.role)) {
        setRawActiveView(view);
      } else {
        setRawActiveView('dashboard');
      }
    },
    []
  );

  // Enforce dependent scoping
  const selectedMemberId = roleCapabilities.isDependent
    ? activeProfile.id
    : rawSelectedMemberId;

  const setSelectedMemberId = useCallback(
    (id: string | 'all') => {
      if (getRoleCapabilities(activeProfileRef.current.role).isDependent) {
        setRawSelectedMemberId(activeProfileRef.current.id);
      } else {
        setRawSelectedMemberId(id);
      }
    },
    []
  );

  // Auto-redirect away from restricted view if activeProfile role changes
  useEffect(() => {
    if (!isViewAllowedForRole(activeView, activeProfile.role)) {
      setRawActiveView('dashboard');
    }
  }, [activeProfile.role, activeView]);

  const persistRevision = useCallback((rev: number) => {
    syncRevisionRef.current = rev;
    setSyncRevision(rev);
    try {
      if (typeof localStorage !== 'undefined') {
        const hhId = authSessionRef.current?.householdId || 'default';
        localStorage.setItem(`${SYNC_REVISION_KEY}:${hhId}`, String(rev));
      }
    } catch {
      // ignore
    }
  }, []);

  const getSyncConfig = useCallback(
    (): SyncClientConfig => ({
      serverUrl: stateRef.current.settings.syncServerUrl,
      syncKey: stateRef.current.settings.syncKey,
      authToken: authSessionRef.current?.token,
    }),
    []
  );

  const applySessionTransition = useCallback(
    (session: AuthSession, explicitInitialState?: AppState, targetView: ActiveView = 'dashboard') => {
      try {
        if (typeof window !== 'undefined' && window.location.pathname !== '/') {
          window.history.replaceState({}, '', '/');
        }
      } catch {
        // ignore
      }
      const preservedLang = stateRef.current.settings.language ?? 'en';
      const preservedTheme = stateRef.current.settings.theme ?? 'light';
      suppressNextPushRef.current = true;
      setAuthSession(session);
      authSessionRef.current = session;
      setRawSelectedMemberId(session.role === 'dependent' ? session.memberId : 'all');
      setRawActiveView(targetView);
      setSyncStatus('local-only');
      syncRevisionRef.current = 0;
      setSyncRevision(0);

      let nextState = explicitInitialState;
      if (!nextState) {
        nextState = loadSyncBootstrapState(session);
      }
      nextState = {
        ...nextState,
        settings: {
          ...nextState.settings,
          language: nextState.settings.language || preservedLang,
          theme: preservedTheme,
          ...(session.planTier ? { planTier: session.planTier } : {}),
          ...(session.trialEndsAt ? { trialEndsAt: session.trialEndsAt } : {}),
        },
      };
      dispatch({ type: 'HYDRATE_STATE', payload: nextState });
    },
    []
  );

  const signInWithCredentials: FinanceContextValue['signInWithCredentials'] = async (
    email,
    password,
    redirectView
  ) => {
    const res = await signInAccount({
      email,
      password,
      syncWithServer:
        import.meta.env.MODE !== 'test' && stateRef.current.settings.syncEnabled !== false,
    });
    if (!res.ok || !res.session) {
      return { ok: false, errorKey: res.errorKey ?? 'auth.errInvalidCreds' };
    }
    const target =
      redirectView && res.session.role !== 'dependent' ? redirectView : 'dashboard';
    applySessionTransition(res.session, undefined, target);
    pushToast(tr('toast.signedInAs', { name: res.session.name }));
    return { ok: true };
  };

  const signUpWithAccount: FinanceContextValue['signUpWithAccount'] = async (options) => {
    const res = await signUpAccount({
      name: options.name,
      email: options.email,
      password: options.password,
      role: options.role,
      householdName: options.householdName,
      planTier: 'free',
      inviteCode: options.inviteCode,
      existingMembers: options.inviteCode ? stateRef.current.members : [],
      syncWithServer:
        import.meta.env.MODE !== 'test' && stateRef.current.settings.syncEnabled !== false,
    });
    if (!res.ok || !res.session) {
      return { ok: false, errorKey: res.errorKey ?? 'auth.errInvalidFields' };
    }
    const lang = stateRef.current.settings.language ?? 'en';
    let starter: AppState | undefined;
    if (res.joinedExistingHousehold) {
      const base = loadSyncBootstrapState(res.session);
      starter = res.newMember
        ? {
            ...base,
            members: [...base.members.filter((m) => m.id !== res.newMember!.id), res.newMember],
          }
        : base;
    } else {
      starter = createCleanHouseholdSeed({
        memberId: res.session.memberId,
        name: res.session.name,
        role: res.session.role,
        avatar: res.session.avatar,
        householdName: options.householdName?.trim() || res.session.householdName,
        planTier: res.session.planTier ?? 'free',
        language: lang,
        baseCurrency: options.baseCurrency,
      });
    }
    const target =
      options.redirectView && res.session.role !== 'dependent' ? options.redirectView : 'dashboard';
    applySessionTransition(res.session, starter, target);
    const hhId = res.session.householdId || 'default';
    void saveAppStateToRepo(starter, hhId);
    pushToast(tr('toast.accountCreated', { name: res.session.name }));
    return { ok: true };
  };

  const enterGuestDemo = useCallback(
    (presetIndex = 0) => {
      const session = createGuestDemoSession(presetIndex);
      applySessionTransition(session, createSeedState());
    },
    [applySessionTransition]
  );

  const signOut = useCallback(() => {
    const token = authSessionRef.current?.token;
    if (import.meta.env.MODE !== 'test') {
      void logoutFromServer(token);
    }
    try {
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.history.replaceState({}, '', '/');
      }
    } catch {
      // ignore
    }
    persistAuthSession(null);
    setAuthSession(null);
    authSessionRef.current = null;
    setSyncStatus('local-only');
    setRawActiveView('dashboard');
  }, []);

  const deleteHouseholdAccount = useCallback(async (): Promise<boolean> => {
    const sess = authSessionRef.current;
    if (!sess) return false;
    const hhId = sess.householdId || 'default';
    if (import.meta.env.MODE !== 'test' && !sess.isDemo) {
      await deleteAccountFromServer(sess.token);
    }
    await deleteAppStateFromRepo(hhId);
    try {
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.history.replaceState({}, '', '/');
      }
    } catch {
      // ignore
    }
    persistAuthSession(null);
    setAuthSession(null);
    authSessionRef.current = null;
    setSyncStatus('local-only');
    setRawActiveView('dashboard');
    return true;
  }, []);

  const refreshSessionFromServer = useCallback(async () => {
    if (import.meta.env.MODE === 'test') return;
    const serverSess = await fetchCurrentAuthSession(getSyncConfig());
    if (serverSess) {
      persistAuthSession(serverSess);
      setAuthSession(serverSess);
      if (serverSess.planTier) {
        dispatch({
          type: 'UPDATE_SETTINGS',
          patch: {
            planTier: serverSess.planTier,
            trialEndsAt: serverSess.trialEndsAt,
          },
        });
      }
    }
  }, [getSyncConfig]);

  const upgradePlan = (tier: PlanTier) => {
    markMutated();
    const trialEndsAt =
      tier === 'plus'
        ? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
        : undefined;
    dispatch({
      type: 'UPDATE_SETTINGS',
      patch: { planTier: tier, trialEndsAt },
    });
    if (authSessionRef.current) {
      const updatedSess: AuthSession = {
        ...authSessionRef.current,
        planTier: tier,
        trialEndsAt,
      };
      persistAuthSession(updatedSess);
      setAuthSession(updatedSess);
    }
    recordAudit('settings', tr('audit.upgradePlan', { tier }), 'settings');
    pushToast(tr('toast.planUpdated', { tier }));
  };

  const openQuickAdd = useCallback((editingTx: Transaction | null = null) => {
    setEditingTransaction(editingTx);
    setIsQuickAddOpen(true);
  }, []);

  const closeQuickAdd = useCallback(() => {
    setIsQuickAddOpen(false);
    setEditingTransaction(null);
  }, []);

  const openReceiptPreview = useCallback((txId: string) => setReceiptPreviewTxId(txId), []);
  const closeReceiptPreview = useCallback(() => setReceiptPreviewTxId(null), []);
  const openCommandPalette = useCallback(() => setIsCommandPaletteOpen(true), []);
  const closeCommandPalette = useCallback(() => setIsCommandPaletteOpen(false), []);
  const toggleCommandPalette = useCallback(
    () => setIsCommandPaletteOpen((open) => !open),
    []
  );
  const openQuickAddBlank = useCallback(() => openQuickAdd(null), [openQuickAdd]);

  useGlobalShortcuts({
    isAnyModalOpen: isCommandPaletteOpen || isQuickAddOpen || Boolean(receiptPreviewTxId),
    onToggleCommandPalette: toggleCommandPalette,
    onOpenQuickAdd: openQuickAddBlank,
  });

  const applyRemoteSnapshot = useCallback(
    async (
      remoteState: AppState,
      remoteRev: number,
      remoteActivity?: ActivityEntry[],
      updatedAt?: string | null
    ) => {
      const { cleanState } = await sanitizeAndMigrateState({
        ...remoteState,
        auditLog: remoteActivity ?? remoteState.auditLog ?? [],
      });
      suppressNextPushRef.current = true;
      dispatch({ type: 'HYDRATE_STATE', payload: cleanState });
      persistRevision(remoteRev);
      if (updatedAt) setLastSyncedAt(updatedAt);
      setSyncStatus('synced');
    },
    [persistRevision]
  );

  const syncNow = useCallback(
    async (forcePush = false) => {
      if (stateRef.current.settings.syncEnabled === false) {
        setSyncStatus('local-only');
        return;
      }
      const config = getSyncConfig();
      setSyncStatus('connecting');
      const health = await checkSyncHealth(config);
      if (!health.available) {
        setSyncStatus('offline');
        return;
      }

      if (!forcePush && (health.revision ?? 0) > syncRevisionRef.current) {
        const remote = await fetchServerState(config);
        if (remote?.state) {
          await applyRemoteSnapshot(
            remote.state,
            remote.revision,
            remote.activity,
            remote.updatedAt
          );
          pushToast(tr('toast.syncedRev', { rev: remote.revision }));
          return;
        }
      }

      const actor = activeProfileRef.current;
      const pushed = await pushServerState(config, {
        baseRevision: syncRevisionRef.current,
        state: stateRef.current,
        actor: {
          memberId: actor.id,
          memberName: actor.name,
          memberAvatar: actor.avatar,
        },
        auditEntry: pendingAuditRef.current ?? {
          action: 'sync',
          summary: tr('audit.syncDefault', {
            name: localizeMemberName(actor, stateRef.current.settings.language ?? 'en'),
          }),
          entityType: 'sync',
        },
        clientId: clientIdRef.current,
        force: forcePush,
      });

      pendingAuditRef.current = null;

      if (!pushed) {
        setSyncStatus('offline');
        return;
      }

      if (!pushed.ok && pushed.conflict && pushed.serverState) {
        setSyncStatus('conflict');
        await applyRemoteSnapshot(
          pushed.serverState,
          pushed.serverRevision,
          pushed.activity,
          pushed.updatedAt
        );
        pushToast(tr('toast.mergedConflict'));
        return;
      }

      if (pushed.ok) {
        persistRevision(pushed.revision);
        setLastSyncedAt(pushed.updatedAt);
        setSyncStatus('synced');
        suppressNextPushRef.current = true;
        dispatch({ type: 'REPLACE_AUDIT_LOG', entries: pushed.activity });
      }
    },
    [applyRemoteSnapshot, getSyncConfig, persistRevision, pushToast]
  );

  // Hydrate asynchronously per-household from IndexedDB & connect SQLite sync when signed in
  useEffect(() => {
    let active = true;
    const isTestEnv = import.meta.env.MODE === 'test';
    const currentSess = authSession;

    if (!currentSess) {
      if (!isTestEnv) {
        void fetchCurrentAuthSession().then((serverSess) => {
          if (active && serverSess) {
            persistAuthSession(serverSess);
            applySessionTransition(serverSess);
          }
        });
      }
      isHydratedRef.current = true;
      setIsStorageHydrated(true);
      return () => {
        active = false;
      };
    }

    const hhId = currentSess.householdId || (currentSess.isDemo ? DEMO_HOUSEHOLD_ID : 'default');

    (async () => {
      let currentLocal = stateRef.current;

      if (hasIndexedDb()) {
        try {
          const { state: loaded, migratedFromLegacy } = await loadAppStateFromRepo(hhId);
          if (!active) return;

          if (loaded && !hasMutatedBeforeHydrationRef.current) {
            const { nextState, postedCount, postedTitles } = runDueAutoPost(loaded);
            currentLocal = nextState;
            suppressNextPushRef.current = true;
            dispatch({ type: 'HYDRATE_STATE', payload: nextState });
            if (loaded.settings.pinEnabled) {
              setIsUnlocked(false);
            }
            if (migratedFromLegacy) {
              pushToast(tr('toast.migratedIdb'));
            }
            if (postedCount > 0) {
              pushToast(
                tr('toast.autoPostedCount', {
                  count: postedCount,
                  noun: postedCount === 1 ? tr('toast.itemSingular') : tr('toast.itemPlural'),
                  titles: postedTitles.join(', '),
                }),
                () => dispatch({ type: 'RESTORE_STATE', payload: loaded })
              );
            }
            void purgeOrphanReceipts(nextState.transactions);
          } else {
            await saveAppStateToRepo(stateRef.current, hhId);
            void purgeOrphanReceipts(stateRef.current.transactions);
          }
        } catch {
          // Fallback safely
        } finally {
          if (active) {
            isHydratedRef.current = true;
            setIsStorageHydrated(true);
          }
        }
      }

      // Server SQLite sync handshake applies strictly to real authenticated accounts (never Demo)
      if (!active || isTestEnv || currentSess.isDemo || currentLocal.settings.syncEnabled === false) {
        return;
      }

      const config: SyncClientConfig = {
        serverUrl: currentLocal.settings.syncServerUrl,
        syncKey: currentLocal.settings.syncKey,
        authToken: currentSess.token,
      };
      const health = await checkSyncHealth(config);
      if (!active) return;

      if (!health.available) {
        setSyncStatus('offline');
        return;
      }

      const remote = await fetchServerState(config);
      if (!active) return;

      if (!remote) {
        // Server is reachable but rejected cached session token (e.g., rotated/expired DB session)
        const activeOnServer = await fetchCurrentAuthSession(config);
        if (active && !activeOnServer) {
          persistAuthSession(null);
          setAuthSession(null);
          authSessionRef.current = null;
          setSyncStatus('local-only');
        }
        return;
      }

      if (remote && remote.state && remote.revision > 0) {
        if (
          (syncRevisionRef.current === 0 || remote.revision >= syncRevisionRef.current) &&
          !hasMutatedBeforeHydrationRef.current
        ) {
          await applyRemoteSnapshot(
            remote.state,
            remote.revision,
            remote.activity,
            remote.updatedAt
          );
          if (remote.state.settings.pinEnabled) {
            setIsUnlocked(false);
          }
        } else {
          setSyncStatus('synced');
        }
      } else {
        // Initialize new isolated server household row with current clean state
        const actor = activeProfileRef.current;
        const pushed = await pushServerState(config, {
          baseRevision: 0,
          state: currentLocal,
          actor: {
            memberId: actor.id,
            memberName: actor.name,
            memberAvatar: actor.avatar,
          },
          auditEntry: {
            action: 'init',
            summary: tr('audit.initSync', {
              name: localizeMemberName(actor, stateRef.current.settings.language ?? 'en'),
            }),
            entityType: 'sync',
          },
          clientId: clientIdRef.current,
        });
        if (active && pushed?.ok) {
          persistRevision(pushed.revision);
          setLastSyncedAt(pushed.updatedAt);
          setSyncStatus('synced');
          suppressNextPushRef.current = true;
          dispatch({ type: 'REPLACE_AUDIT_LOG', entries: pushed.activity });
        } else if (active && pushed && !pushed.ok && pushed.conflict && pushed.serverState) {
          await applyRemoteSnapshot(
            pushed.serverState,
            pushed.serverRevision,
            pushed.activity,
            pushed.updatedAt
          );
          if (pushed.serverState.settings.pinEnabled) {
            setIsUnlocked(false);
          }
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [
    authSession?.householdId,
    authSession?.userId,
    authSession?.isDemo,
    applyRemoteSnapshot,
    applySessionTransition,
    persistRevision,
    pushToast,
    tr,
  ]);

  // Subscribe to Server-Sent Events only for authenticated real households after sync succeeds
  useEffect(() => {
    if (
      import.meta.env.MODE === 'test' ||
      !authSession ||
      authSession.isDemo ||
      state.settings.syncEnabled === false ||
      syncStatus !== 'synced'
    ) {
      return;
    }
    const config: SyncClientConfig = {
      serverUrl: state.settings.syncServerUrl,
      syncKey: state.settings.syncKey,
      authToken: authSession.token,
    };

    const unsubscribe = subscribeToSyncEvents(config, async (evt) => {
      if (evt.clientId === clientIdRef.current) return;
      if (evt.revision <= syncRevisionRef.current) return;
      const remote = await fetchServerState(config);
      if (remote?.state) {
        await applyRemoteSnapshot(
          remote.state,
          remote.revision,
          remote.activity,
          remote.updatedAt
        );
        pushToast(
          evt.actorName
            ? tr('toast.syncedFromActor', { actor: evt.actorName })
            : tr('toast.syncedRemoteRev', { rev: remote.revision })
        );
      }
    });

    return unsubscribe;
  }, [
    authSession,
    syncStatus,
    state.settings.syncEnabled,
    state.settings.syncServerUrl,
    state.settings.syncKey,
    applyRemoteSnapshot,
    pushToast,
    tr,
  ]);

  // Persist locally & debounce push to SQLite sync server on state changes
  useEffect(() => {
    if (!authSession) return;
    if (!isHydratedRef.current && hasIndexedDb()) return;
    const hhId = authSession.householdId || (authSession.isDemo ? DEMO_HOUSEHOLD_ID : 'default');
    void saveAppStateToRepo(state, hhId);

    if (suppressNextPushRef.current) {
      suppressNextPushRef.current = false;
      return;
    }

    if (
      import.meta.env.MODE === 'test' ||
      authSession.isDemo ||
      state.settings.syncEnabled === false ||
      syncStatusRef.current === 'local-only'
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      void syncNow(false);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [authSession, state, syncNow]);

  // Apply theme & language to <html>
  useEffect(() => {
    const root = document.documentElement;
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const dark =
      state.settings.theme === 'dark' || (state.settings.theme === 'system' && prefersDark);
    root.classList.toggle('dark', dark);

    const activeLang: AppLanguage = state.settings.language === 'gu' ? 'gu' : 'en';
    root.lang = activeLang;
    document.title = translate(activeLang, 'meta.docTitle');
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LANGUAGE_KEY, activeLang);
      }
    } catch {
      // ignore
    }
  }, [state.settings.theme, state.settings.language]);

  const markMutated = () => {
    hasMutatedBeforeHydrationRef.current = true;
  };

  const recordAudit = (
    action: string,
    summary: string,
    entityType: ActivityEntityType
  ) => {
    const actor = activeProfileRef.current;
    const entry: ActivityEntry = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      memberId: actor.id,
      memberName: actor.name,
      memberAvatar: actor.avatar,
      action,
      summary,
      entityType,
      createdAt: new Date().toISOString(),
    };
    pendingAuditRef.current = { action, summary, entityType };
    dispatch({ type: 'APPEND_AUDIT_LOG', entry });
  };

  const getReceiptWithSync = useCallback(
    async (receiptId: string): Promise<ReceiptRecord | null> => {
      const local = await getReceiptRecord(receiptId);
      if (local) return local;
      if (import.meta.env.MODE === 'test' || stateRef.current.settings.syncEnabled === false) {
        return null;
      }
      const remote = await fetchServerReceipt(getSyncConfig(), receiptId);
      if (remote) {
        await saveReceiptRecord(remote);
      }
      return remote;
    },
    [getSyncConfig]
  );

  const unlockApp = async (pin: string): Promise<boolean> => {
    const ok = await verifyPinAgainstSettings(pin, stateRef.current.settings);
    if (ok) {
      setIsUnlocked(true);
      return true;
    }
    return false;
  };

  const setHouseholdPin = async (newPin: string): Promise<void> => {
    markMutated();
    const { pinHash, pinSalt } = await createPinCredentials(newPin);
    dispatch({ type: 'SET_PIN_CREDS', pinHash, pinSalt });
    recordAudit('security', tr('audit.pinUpdated'), 'settings');
    pushToast(tr('toast.pinUpdated'));
  };

  const disableHouseholdPin = () => {
    markMutated();
    dispatch({ type: 'DISABLE_PIN' });
    recordAudit('security', tr('audit.pinDisabled'), 'settings');
    pushToast(tr('toast.pinDisabled'));
  };

  const addTransaction: FinanceContextValue['addTransaction'] = (txInput) => {
    markMutated();
    const txId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const inlineDataUrl = txInput.receiptDataUrl;
    const receiptId = inlineDataUrl ? `rcpt-${txId}` : txInput.receiptId;
    const receiptSizeBytes = inlineDataUrl
      ? txInput.receiptSizeBytes ?? estimateDataUrlBytes(inlineDataUrl)
      : txInput.receiptSizeBytes;

    if (inlineDataUrl && receiptId) {
      const mimeMatch = /^data:([^;]+);/.exec(inlineDataUrl);
      const rec: ReceiptRecord = {
        id: receiptId,
        txId,
        fileName: txInput.receiptName ?? 'receipt.png',
        mimeType: mimeMatch?.[1] ?? 'image/png',
        sizeBytes: receiptSizeBytes ?? 0,
        dataUrl: inlineDataUrl,
        createdAt: new Date().toISOString(),
      };
      void saveReceiptRecord(rec);
      if (import.meta.env.MODE !== 'test' && stateRef.current.settings.syncEnabled !== false) {
        void pushServerReceipt(getSyncConfig(), rec);
      }
    }

    const { receiptDataUrl: _stripped, ...restInput } = txInput;
    dispatch({
      type: 'ADD_TRANSACTION',
      payload: {
        ...restInput,
        id: txId,
        receiptId,
        receiptSizeBytes,
        baseAmount: restInput.amount,
        createdAt: new Date().toISOString(),
      },
    });
    const lang = stateRef.current.settings.language ?? 'en';
    recordAudit(
      'add',
      tr('audit.addTx', {
        txType: localizeTxType(txInput.type, lang),
        merchant: txInput.merchant,
        amount: txInput.amount,
        currency: txInput.currency,
      }),
      'transaction'
    );
    pushToast(tr('toast.savedTx', { merchant: txInput.merchant }));
  };

  const updateTransaction: FinanceContextValue['updateTransaction'] = (id, patch) => {
    markMutated();
    const inlineDataUrl = patch.receiptDataUrl;
    const existing = stateRef.current.transactions.find((t) => t.id === id);
    let nextReceiptId = patch.receiptId ?? existing?.receiptId;
    let nextReceiptSize = patch.receiptSizeBytes ?? existing?.receiptSizeBytes;

    if (inlineDataUrl) {
      nextReceiptId = nextReceiptId ?? `rcpt-${id}`;
      nextReceiptSize = patch.receiptSizeBytes ?? estimateDataUrlBytes(inlineDataUrl);
      const mimeMatch = /^data:([^;]+);/.exec(inlineDataUrl);
      const rec: ReceiptRecord = {
        id: nextReceiptId,
        txId: id,
        fileName: patch.receiptName ?? existing?.receiptName ?? 'receipt.png',
        mimeType: mimeMatch?.[1] ?? 'image/png',
        sizeBytes: nextReceiptSize,
        dataUrl: inlineDataUrl,
        createdAt: new Date().toISOString(),
      };
      void saveReceiptRecord(rec);
      if (import.meta.env.MODE !== 'test' && stateRef.current.settings.syncEnabled !== false) {
        void pushServerReceipt(getSyncConfig(), rec);
      }
    }

    const { receiptDataUrl: _stripped, ...cleanPatch } = patch;
    dispatch({
      type: 'UPDATE_TRANSACTION',
      id,
      patch: {
        ...cleanPatch,
        receiptId: nextReceiptId,
        receiptSizeBytes: nextReceiptSize,
      },
    });
    recordAudit(
      'edit',
      tr('audit.editTx', { name: patch.merchant ?? existing?.merchant ?? id }),
      'transaction'
    );
    pushToast(tr('toast.updatedTx'));
  };

  const toggleTransactionStatus = (id: string) => {
    const tx = stateRef.current.transactions.find((t) => t.id === id);
    if (!tx) return;
    markMutated();
    const nextStatus: Transaction['status'] = tx.status === 'cleared' ? 'pending' : 'cleared';
    const lang = stateRef.current.settings.language ?? 'en';
    dispatch({ type: 'MARK_TRANSACTIONS_STATUS', ids: [id], status: nextStatus });
    recordAudit('edit', tr('audit.editTx', { name: tx.merchant }), 'transaction');
    pushToast(
      tr('toast.updatedStatus', {
        merchant: tx.merchant,
        status: localizeTxStatus(nextStatus, lang),
      })
    );
  };

  const markTransactionsStatus = (ids: string[], status: Transaction['status']) => {
    if (ids.length === 0) return;
    markMutated();
    dispatch({ type: 'MARK_TRANSACTIONS_STATUS', ids, status });
    recordAudit(
      'edit',
      tr('audit.editTx', { name: `${ids.length} entries` }),
      'transaction'
    );
    pushToast(tr('toast.bulkCleared', { count: ids.length }));
  };

  const reconcileAccountBalance = (accountId: string, statementBalance: number) => {
    const account = stateRef.current.accounts.find((a) => a.id === accountId);
    if (!account || !Number.isFinite(statementBalance)) return;
    const cleared = computeClearedAccountBalance(account, stateRef.current.transactions);
    const diff = Number((statementBalance - cleared).toFixed(2));
    if (Math.abs(diff) < 0.01) return;

    markMutated();
    const lang = stateRef.current.settings.language ?? 'en';
    const txType: Transaction['type'] = diff > 0 ? 'income' : 'expense';
    const absAmount = Math.abs(diff);
    const categoryId =
      stateRef.current.categories.find((c) => c.type === txType)?.id ??
      stateRef.current.categories[0]?.id ??
      'cat-shopping';
    const newTx: Transaction = {
      id: `tx-rec-adj-${Date.now()}`,
      type: txType,
      amount: absAmount,
      currency: account.currency,
      baseAmount: convertCurrency(
        absAmount,
        account.currency,
        stateRef.current.settings.baseCurrency,
        stateRef.current.settings.exchangeRates
      ),
      date: todayISO(),
      merchant: tr('acc.reconcileAdjMerchant'),
      categoryId,
      accountId: account.id,
      memberId: account.ownerId || stateRef.current.members[0]?.id || 'm-shared',
      tags: ['reconciliation'],
      note: tr('acc.reconcileAdjNote'),
      status: 'cleared',
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_TRANSACTION', payload: newTx });
    const accLabel = localizeAccountName(account, lang);
    recordAudit(
      'account',
      tr('audit.reconcileAccount', { amount: `${diff > 0 ? '+' : '-'}${absAmount}`, account: accLabel }),
      'settings'
    );
    pushToast(
      tr('toast.reconciledAccount', {
        account: accLabel,
        diff: `${diff > 0 ? '+' : '-'}${absAmount} ${account.currency}`,
      })
    );
  };

  const attachReceiptToTransaction: FinanceContextValue['attachReceiptToTransaction'] = async (
    txId,
    receipt
  ) => {
    markMutated();
    const receiptId = `rcpt-${txId}`;
    const rec: ReceiptRecord = {
      id: receiptId,
      txId,
      fileName: receipt.fileName,
      mimeType: receipt.mimeType,
      sizeBytes: receipt.sizeBytes,
      dataUrl: receipt.dataUrl,
      createdAt: new Date().toISOString(),
    };
    await saveReceiptRecord(rec);
    if (import.meta.env.MODE !== 'test' && stateRef.current.settings.syncEnabled !== false) {
      void pushServerReceipt(getSyncConfig(), rec);
    }
    const tx = stateRef.current.transactions.find((t) => t.id === txId);
    dispatch({
      type: 'ATTACH_RECEIPT_META',
      txId,
      receiptId,
      receiptName: receipt.fileName,
      receiptSizeBytes: receipt.sizeBytes,
    });
    recordAudit(
      'receipt',
      tr('audit.attachReceipt', {
        fileName: receipt.fileName,
        merchant: tx?.merchant ?? txId,
      }),
      'receipt'
    );
    pushToast(tr('toast.attachedReceipt', { fileName: receipt.fileName }));
  };

  const removeReceiptFromTransaction = async (txId: string): Promise<void> => {
    markMutated();
    const prevSnapshot = stateRef.current;
    const tx = prevSnapshot.transactions.find((t) => t.id === txId);
    const receiptId = tx?.receiptId;
    const backupRecord = receiptId ? await getReceiptRecord(receiptId) : null;

    if (receiptId) {
      await deleteReceiptRecord(receiptId);
      if (import.meta.env.MODE !== 'test' && stateRef.current.settings.syncEnabled !== false) {
        void deleteServerReceipt(getSyncConfig(), receiptId);
      }
    }
    dispatch({ type: 'REMOVE_RECEIPT_META', txId });
    const merchantFallback = tx?.merchant ?? (stateRef.current.settings.language === 'gu' ? 'વ્યવહાર' : 'transaction');
    recordAudit(
      'receipt',
      tr('audit.removeReceipt', { merchant: merchantFallback }),
      'receipt'
    );

    pushToast(tr('toast.removedReceipt', { merchant: merchantFallback }), () => {
      if (backupRecord) {
        void saveReceiptRecord(backupRecord);
        if (import.meta.env.MODE !== 'test' && stateRef.current.settings.syncEnabled !== false) {
          void pushServerReceipt(getSyncConfig(), backupRecord);
        }
      }
      dispatch({ type: 'RESTORE_STATE', payload: prevSnapshot });
    });
  };

  const deleteTransactions = (ids: string[]) => {
    if (ids.length === 0) return;
    markMutated();
    const prevSnapshot = stateRef.current;
    dispatch({ type: 'DELETE_TRANSACTIONS', ids });
    const noun = ids.length === 1 ? tr('toast.txSingular') : tr('toast.txPlural');
    recordAudit('delete', tr('audit.deleteTxs', { count: ids.length, noun }), 'transaction');
    pushToast(
      tr('toast.deletedTxs', { count: ids.length, noun }),
      () => dispatch({ type: 'RESTORE_STATE', payload: prevSnapshot }),
      () => void purgeOrphanReceipts(stateRef.current.transactions)
    );
  };

  const importTransactions = (txs: Transaction[]) => {
    markMutated();
    const prevSnapshot = stateRef.current;
    dispatch({ type: 'IMPORT_TRANSACTIONS', payload: txs });
    recordAudit('import', tr('audit.importCsv', { count: txs.length }), 'transaction');
    pushToast(tr('toast.importedTxs', { count: txs.length }), () =>
      dispatch({ type: 'RESTORE_STATE', payload: prevSnapshot })
    );
  };

  const settleMemberSplit = (txId: string, memberId: string) => {
    markMutated();
    const tx = stateRef.current.transactions.find((t) => t.id === txId);
    const mem = stateRef.current.members.find((m) => m.id === memberId);
    const lang = stateRef.current.settings.language ?? 'en';
    dispatch({ type: 'SETTLE_MEMBER_SPLIT', txId, memberId });
    recordAudit(
      'settle',
      tr('audit.toggleSplit', {
        member: mem ? localizeMemberName(mem, lang) : memberId,
        merchant: tx?.merchant ?? txId,
      }),
      'family'
    );
  };

  const settleMemberPairIous: FinanceContextValue['settleMemberPairIous'] = (
    fromMemberId,
    toMemberId,
    amount,
    options
  ) => {
    markMutated();
    const prevSnapshot = stateRef.current;
    const fromMem = prevSnapshot.members.find((m) => m.id === fromMemberId);
    const toMem = prevSnapshot.members.find((m) => m.id === toMemberId);
    const lang = prevSnapshot.settings.language ?? 'en';
    const fromLabel = fromMem ? localizeMemberName(fromMem, lang) : 'Member';
    const toLabel = toMem ? localizeMemberName(toMem, lang) : 'Member';
    const accountId = options?.accountId ?? prevSnapshot.accounts[0]?.id ?? '';

    const settlementTx: Transaction | undefined =
      options?.recordEntry && amount > 0 && accountId
        ? {
            id: `tx-settle-${Date.now()}`,
            type: 'transfer',
            amount,
            currency: prevSnapshot.settings.baseCurrency,
            baseAmount: amount,
            date: todayISO(),
            merchant: tr('audit.iouMerchant', { from: fromLabel, to: toLabel }),
            categoryId: 'cat-savings-tx',
            accountId,
            toAccountId: accountId,
            memberId: fromMemberId,
            tags: ['iou-settlement'],
            note: tr('audit.iouNote'),
            status: 'cleared',
            createdAt: new Date().toISOString(),
          }
        : undefined;

    dispatch({
      type: 'SETTLE_MEMBER_PAIR_IOUS',
      fromMemberId,
      toMemberId,
      settlementTx,
    });
    recordAudit(
      'settle',
      tr('audit.settlePair', { from: fromLabel, to: toLabel, amount }),
      'family'
    );
    pushToast(tr('toast.settledPair', { from: fromLabel, to: toLabel }), () =>
      dispatch({ type: 'RESTORE_STATE', payload: prevSnapshot })
    );
  };

  const upsertMember = (member: FamilyMember) => {
    markMutated();
    const lang = stateRef.current.settings.language ?? 'en';
    dispatch({ type: 'UPSERT_MEMBER', payload: member });
    recordAudit('member', tr('audit.upsertMember', { name: localizeMemberName(member, lang) }), 'family');
  };

  const deleteMember = (id: string) => {
    markMutated();
    const prevSnapshot = stateRef.current;
    const target = prevSnapshot.members.find((m) => m.id === id);
    const lang = prevSnapshot.settings.language ?? 'en';
    const targetName = target ? localizeMemberName(target, lang) : id;
    dispatch({ type: 'DELETE_MEMBER', id });
    recordAudit('member', tr('audit.removeMember', { name: targetName }), 'family');
    pushToast(tr('toast.removedMember', { name: target ? targetName : '' }), () =>
      dispatch({ type: 'RESTORE_STATE', payload: prevSnapshot })
    );
  };

  const upsertAccount = (account: Account) => {
    markMutated();
    dispatch({ type: 'UPSERT_ACCOUNT', payload: account });
    recordAudit('account', tr('audit.saveAccount', { name: account.name }), 'settings');
  };

  const deleteAccount = (id: string) => {
    markMutated();
    const prevSnapshot = stateRef.current;
    const target = prevSnapshot.accounts.find((a) => a.id === id);
    dispatch({ type: 'DELETE_ACCOUNT', id });
    pushToast(tr('toast.deletedAccount', { name: target?.name ?? '' }), () =>
      dispatch({ type: 'RESTORE_STATE', payload: prevSnapshot })
    );
  };

  const upsertCategory = (category: Category) => {
    markMutated();
    dispatch({ type: 'UPSERT_CATEGORY', payload: category });
    recordAudit('budget', tr('audit.saveCategory', { name: category.name }), 'budget');
  };

  const deleteCategory = (id: string) => {
    markMutated();
    const prevSnapshot = stateRef.current;
    const target = prevSnapshot.categories.find((c) => c.id === id);
    dispatch({ type: 'DELETE_CATEGORY', id });
    pushToast(tr('toast.deletedCategory', { name: target?.name ?? '' }), () =>
      dispatch({ type: 'RESTORE_STATE', payload: prevSnapshot })
    );
  };

  const upsertRecurring = (rule: RecurringRule) => {
    markMutated();
    dispatch({ type: 'UPSERT_RECURRING', payload: rule });
    recordAudit('bill', tr('audit.saveRecurring', { title: rule.title }), 'bill');
  };

  const deleteRecurring = (id: string) => {
    markMutated();
    const prevSnapshot = stateRef.current;
    const target = prevSnapshot.recurring.find((r) => r.id === id);
    dispatch({ type: 'DELETE_RECURRING', id });
    pushToast(tr('toast.deletedSchedule', { title: target?.title ?? '' }), () =>
      dispatch({ type: 'RESTORE_STATE', payload: prevSnapshot })
    );
  };

  const postRecurringDue = (ruleId: string) => {
    markMutated();
    const prevSnapshot = stateRef.current;
    const rule = prevSnapshot.recurring.find((r) => r.id === ruleId);
    if (!rule) return;
    dispatch({
      type: 'POST_RECURRING_DUE',
      ruleId,
      postedTxId: `tx-rec-${Date.now()}`,
      createdAt: new Date().toISOString(),
    });
    recordAudit('bill', tr('audit.postRecurring', { title: rule.title }), 'bill');
    pushToast(tr('toast.postedTitle', { title: rule.title }), () =>
      dispatch({ type: 'RESTORE_STATE', payload: prevSnapshot })
    );
  };

  const upsertGoal = (goal: SavingsGoal) => {
    markMutated();
    dispatch({ type: 'UPSERT_GOAL', payload: goal });
    recordAudit('goal', tr('audit.saveGoal', { name: goal.name }), 'goal');
  };

  const contributeGoal = (goalId: string, amount: number, fromAccountId: string, memberId: string) => {
    if (amount <= 0) return;
    markMutated();
    const goal = stateRef.current.goals.find((g) => g.id === goalId);
    dispatch({
      type: 'CONTRIBUTE_GOAL',
      goalId,
      amount,
      fromAccountId,
      memberId,
      txId: `tx-goal-${Date.now()}`,
      date: todayISO(),
      createdAt: new Date().toISOString(),
    });
    recordAudit('goal', tr('audit.contribGoal', { amount, name: goal?.name ?? goalId }), 'goal');
    pushToast(tr('toast.goalContribution'));
  };

  const deleteGoal = (id: string) => {
    markMutated();
    const prevSnapshot = stateRef.current;
    const target = prevSnapshot.goals.find((g) => g.id === id);
    dispatch({ type: 'DELETE_GOAL', id });
    pushToast(tr('toast.deletedGoal', { name: target?.name ?? '' }), () =>
      dispatch({ type: 'RESTORE_STATE', payload: prevSnapshot })
    );
  };

  const upsertDebt = (debt: DebtItem) => {
    markMutated();
    dispatch({ type: 'UPSERT_DEBT', payload: debt });
  };

  const recordDebtPayment = (debtId: string, amount: number, fromAccountId: string, memberId: string) => {
    if (amount <= 0) return;
    markMutated();
    const debt = stateRef.current.debts.find((d) => d.id === debtId);
    dispatch({
      type: 'RECORD_DEBT_PAYMENT',
      debtId,
      amount,
      fromAccountId,
      memberId,
      txId: `tx-debt-${Date.now()}`,
      date: todayISO(),
      createdAt: new Date().toISOString(),
    });
    recordAudit('debt', tr('audit.debtPayment', { amount, name: debt?.name ?? debtId }), 'debt');
    pushToast(tr('toast.debtPayment'));
  };

  const deleteDebt = (id: string) => {
    markMutated();
    const prevSnapshot = stateRef.current;
    const target = prevSnapshot.debts.find((d) => d.id === id);
    dispatch({ type: 'DELETE_DEBT', id });
    pushToast(tr('toast.deletedDebt', { name: target?.name ?? '' }), () =>
      dispatch({ type: 'RESTORE_STATE', payload: prevSnapshot })
    );
  };

  const upsertRule = (rule: MerchantRule) => {
    markMutated();
    dispatch({ type: 'UPSERT_RULE', payload: rule });
    recordAudit('rule', tr('audit.saveRule', { pattern: rule.pattern }), 'rule');
  };

  const deleteRule = (id: string) => {
    markMutated();
    const prevSnapshot = stateRef.current;
    const target = (prevSnapshot.rules ?? []).find((r) => r.id === id);
    dispatch({ type: 'DELETE_RULE', id });
    pushToast(tr('toast.deletedRule', { pattern: target?.pattern ?? '' }), () =>
      dispatch({ type: 'RESTORE_STATE', payload: prevSnapshot })
    );
  };

  const upsertInvestment = (holding: InvestmentHolding) => {
    markMutated();
    dispatch({ type: 'UPSERT_INVESTMENT', payload: holding });
    recordAudit('goal', tr('audit.saveInvestment', { symbol: holding.symbol }), 'goal');
  };

  const deleteInvestment = (id: string) => {
    markMutated();
    const prevSnapshot = stateRef.current;
    const target = (prevSnapshot.investments ?? []).find((h) => h.id === id);
    dispatch({ type: 'DELETE_INVESTMENT', id });
    pushToast(tr('toast.deletedInvestment', { name: target?.name ?? '' }), () =>
      dispatch({ type: 'RESTORE_STATE', payload: prevSnapshot })
    );
  };

  const upsertSip = (sip: SipPlan) => {
    markMutated();
    dispatch({ type: 'UPSERT_SIP', payload: sip });
  };

  const deleteSip = (id: string) => {
    markMutated();
    const prevSnapshot = stateRef.current;
    const target = (prevSnapshot.sips ?? []).find((s) => s.id === id);
    dispatch({ type: 'DELETE_SIP', id });
    pushToast(tr('toast.deletedSip', { name: target?.name ?? '' }), () =>
      dispatch({ type: 'RESTORE_STATE', payload: prevSnapshot })
    );
  };

  const recordSipInstallment = (sipId: string) => {
    const sip = (stateRef.current.sips ?? []).find((s) => s.id === sipId);
    if (!sip) return;
    markMutated();
    const prevSnapshot = stateRef.current;
    dispatch({
      type: 'EXECUTE_SIP_INSTALLMENT',
      sipId,
      txId: `tx-sip-${Date.now()}`,
      date: todayISO(),
      createdAt: new Date().toISOString(),
    });
    recordAudit(
      'goal',
      tr('audit.recordSip', { amount: sip.monthlyAmount, name: sip.name }),
      'goal'
    );
    pushToast(tr('toast.investedSip', { name: sip.name }), () =>
      dispatch({ type: 'RESTORE_STATE', payload: prevSnapshot })
    );
  };

  const upsertPolicy = (policy: InsurancePolicy) => {
    markMutated();
    dispatch({ type: 'UPSERT_POLICY', payload: policy });
    recordAudit('settings', tr('audit.savePolicy', { name: policy.name }), 'settings');
  };

  const deletePolicy = (id: string) => {
    markMutated();
    const prevSnapshot = stateRef.current;
    const target = (prevSnapshot.policies ?? []).find((p) => p.id === id);
    dispatch({ type: 'DELETE_POLICY', id });
    pushToast(tr('toast.deletedPolicy', { name: target?.name ?? '' }), () =>
      dispatch({ type: 'RESTORE_STATE', payload: prevSnapshot })
    );
  };

  const updateEmergencyInfo = (info: EmergencyVaultMeta) => {
    markMutated();
    dispatch({ type: 'UPDATE_EMERGENCY_INFO', payload: info });
    recordAudit('settings', tr('audit.updateEmergency'), 'settings');
    pushToast(tr('toast.savedEmergency'));
  };

  const applyRulesToExistingTransactions = (): number => {
    markMutated();
    const prevSnapshot = stateRef.current;
    const { updatedCount } = applyRulesToTransactions(
      prevSnapshot.transactions,
      prevSnapshot.rules ?? []
    );
    if (updatedCount > 0) {
      dispatch({ type: 'APPLY_RULES_TO_EXISTING' });
      recordAudit('rule', tr('audit.applyRules', { count: updatedCount }), 'rule');
      pushToast(
        tr('toast.updatedRulesCount', {
          count: updatedCount,
          noun: updatedCount === 1 ? tr('toast.txSingular') : tr('toast.txPlural'),
        }),
        () => dispatch({ type: 'RESTORE_STATE', payload: prevSnapshot })
      );
    } else {
      pushToast(tr('toast.allRulesMatch'));
    }
    return updatedCount;
  };

  const runAutoPostNow = (): number => {
    markMutated();
    const prevSnapshot = stateRef.current;
    const { postedCount, postedTitles } = runDueAutoPost(prevSnapshot);
    if (postedCount > 0) {
      dispatch({ type: 'RUN_DUE_AUTOPOST' });
      recordAudit('bill', tr('audit.autoPost', { count: postedCount }), 'bill');
      pushToast(
        tr('toast.autoPostedCount', {
          count: postedCount,
          noun: postedCount === 1 ? tr('toast.itemSingular') : tr('toast.itemPlural'),
          titles: postedTitles.join(', '),
        }),
        () => dispatch({ type: 'RESTORE_STATE', payload: prevSnapshot })
      );
    } else {
      pushToast(tr('toast.noAutoPostDue'));
    }
    return postedCount;
  };

  const upsertCsvPreset = (preset: CsvPreset) => {
    markMutated();
    dispatch({ type: 'UPSERT_CSV_PRESET', payload: preset });
    pushToast(tr('toast.savedPreset', { name: preset.name }));
  };

  const deleteCsvPreset = (id: string) => {
    markMutated();
    const target = (stateRef.current.settings.csvPresets ?? []).find((p) => p.id === id);
    dispatch({ type: 'DELETE_CSV_PRESET', id });
    if (target) {
      pushToast(tr('toast.deletedPreset', { name: target.name }));
    }
  };

  const updateSettings = (patch: Partial<AppSettings>) => {
    markMutated();
    if (patch.language) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(LANGUAGE_KEY, patch.language);
        }
      } catch {
        // ignore
      }
    }
    dispatch({ type: 'UPDATE_SETTINGS', patch });
  };

  const restoreState = async (nextState: AppState, receiptsToRestore?: ReceiptRecord[]) => {
    markMutated();
    const prevSnapshot = stateRef.current;
    const { cleanState, extractedReceipts } = await sanitizeAndMigrateState(nextState);

    for (const r of [...extractedReceipts, ...(receiptsToRestore ?? [])]) {
      await saveReceiptRecord(r);
      if (import.meta.env.MODE !== 'test' && cleanState.settings.syncEnabled !== false) {
        void pushServerReceipt(getSyncConfig(), r);
      }
    }

    dispatch({ type: 'RESTORE_STATE', payload: cleanState });
    recordAudit('restore', tr('audit.restoreBackup'), 'settings');
    pushToast(tr('toast.backupRestored'), () =>
      dispatch({ type: 'RESTORE_STATE', payload: prevSnapshot })
    );
  };

  const resetToDemo = () => {
    markMutated();
    const prevSnapshot = stateRef.current;
    dispatch({ type: 'RESET_TO_DEMO' });
    setRawSelectedMemberId('all');
    setSelectedMonth(todayISO().slice(0, 7));
    pushToast(
      tr('toast.demoLoaded'),
      () => dispatch({ type: 'RESTORE_STATE', payload: prevSnapshot }),
      () => void clearAllReceiptRecords()
    );
  };

  const clearAllData = () => {
    markMutated();
    const prevSnapshot = stateRef.current;
    dispatch({ type: 'CLEAR_ALL_DATA' });
    pushToast(
      tr('toast.clearedData'),
      () => dispatch({ type: 'RESTORE_STATE', payload: prevSnapshot }),
      () => void clearAllReceiptRecords()
    );
  };

  const dispatchStarterTemplate = (nextState: AppState) => {
    markMutated();
    dispatch({ type: 'RESTORE_STATE', payload: nextState });
    recordAudit('template', 'Applied household starter template', 'settings');
  };

  const value = useMemo<FinanceContextValue>(
    () => ({
      state,
      isStorageHydrated,
      storageEngine,
      activeView,
      setActiveView,
      selectedMonth,
      setSelectedMonth,
      selectedMemberId,
      setSelectedMemberId,
      authSession,
      activeProfile,
      roleCapabilities,
      getAuthSyncConfig: getSyncConfig,
      signInWithCredentials,
      signUpWithAccount,
      enterGuestDemo,
      signOut,
      deleteHouseholdAccount,
      upgradePlan,
      refreshSessionFromServer,
      dispatchStarterTemplate,
      syncStatus,
      syncRevision,
      lastSyncedAt,
      syncNow,
      getReceiptWithSync,
      isQuickAddOpen,
      openQuickAdd,
      closeQuickAdd,
      editingTransaction,
      receiptPreviewTxId,
      openReceiptPreview,
      closeReceiptPreview,
      isCommandPaletteOpen,
      openCommandPalette,
      closeCommandPalette,
      isUnlocked,
      unlockApp,
      lockApp,
      setHouseholdPin,
      disableHouseholdPin,
      isOnline,
      canInstallPwa,
      triggerInstallPwa,
      toasts,
      pushToast,
      dismissToast,
      addTransaction,
      updateTransaction,
      toggleTransactionStatus,
      markTransactionsStatus,
      deleteTransactions,
      reconcileAccountBalance,
      importTransactions,
      attachReceiptToTransaction,
      removeReceiptFromTransaction,
      settleMemberSplit,
      settleMemberPairIous,
      upsertMember,
      deleteMember,
      upsertAccount,
      deleteAccount,
      upsertCategory,
      deleteCategory,
      upsertRecurring,
      deleteRecurring,
      postRecurringDue,
      upsertGoal,
      contributeGoal,
      deleteGoal,
      upsertDebt,
      recordDebtPayment,
      deleteDebt,
      upsertRule,
      deleteRule,
      upsertInvestment,
      deleteInvestment,
      upsertSip,
      deleteSip,
      recordSipInstallment,
      upsertPolicy,
      deletePolicy,
      updateEmergencyInfo,
      applyRulesToExistingTransactions,
      runAutoPostNow,
      upsertCsvPreset,
      deleteCsvPreset,
      updateSettings,
      restoreState,
      resetToDemo,
      clearAllData,
    }),
    [
      state,
      isStorageHydrated,
      storageEngine,
      activeView,
      setActiveView,
      selectedMonth,
      selectedMemberId,
      setSelectedMemberId,
      authSession,
      activeProfile,
      roleCapabilities,
      getSyncConfig,
      deleteHouseholdAccount,
      refreshSessionFromServer,
      syncStatus,
      syncRevision,
      lastSyncedAt,
      syncNow,
      getReceiptWithSync,
      isQuickAddOpen,
      editingTransaction,
      receiptPreviewTxId,
      isCommandPaletteOpen,
      isUnlocked,
      isOnline,
      canInstallPwa,
      toasts,
      openQuickAdd,
      closeQuickAdd,
      openReceiptPreview,
      closeReceiptPreview,
      openCommandPalette,
      closeCommandPalette,
      triggerInstallPwa,
      pushToast,
      dismissToast,
      lockApp,
    ]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
};

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used inside FinanceProvider');
  return ctx;
}
