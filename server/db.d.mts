import type { ActivityEntry, AppState } from '../src/types/finance';

export interface HouseholdRecord {
  id: string;
  name: string;
  planTier: string;
  planStatus: string;
  billingCycle: string;
  trialEndsAt: string | null;
  planExpiresAt: string | null;
  billingProvider: string | null;
  createdAt: string;
}

export interface AuthSessionPayload {
  token: string;
  userId: string;
  householdId: string;
  householdName: string;
  name: string;
  email: string;
  role: string;
  memberId: string;
  avatar: string;
  planTier: string;
  planStatus: string;
  trialEndsAt?: string;
  planExpiresAt?: string;
  isDemo: boolean;
}

export interface UpsertGoogleUserInput {
  email: string;
  name?: string;
  googleSub: string;
  avatarUrl?: string;
  inviteCode?: string;
  emailVerified: boolean;
}

export interface UpsertGoogleUserResult {
  userId: string;
  householdId: string;
  role: string;
  memberId: string;
  name: string;
  email: string;
  avatar: string;
  isNewUser: boolean;
}

export interface PendingOrderRecord {
  orderId: string;
  householdId: string;
  provider: string;
  planTier: string;
  billingCycle: string;
  currency: string;
  amountMinor: number;
}

export interface InviteRecord {
  code: string;
  householdId: string;
  role: string;
  invitedEmail: string | null;
  expiresAt: string;
  usedAt?: string | null;
  householdName?: string;
  valid?: boolean;
  expired?: boolean;
}

export interface SyncDatabase {
  getHousehold: (householdId: string) => HouseholdRecord | null;
  updateHouseholdBilling: (
    householdId: string,
    patch: Partial<{
      planTier: string;
      planStatus: string;
      billingCycle: string;
      trialEndsAt: string | null;
      planExpiresAt: string | null;
      billingProvider: string | null;
    }>
  ) => HouseholdRecord | null;
  recordInvoice: (invoice: Record<string, unknown>) => string;
  listInvoices: (householdId: string) => Array<Record<string, unknown>>;
  savePendingOrder: (order: PendingOrderRecord) => void;
  getPendingOrder: (orderId: string) => PendingOrderRecord | null;
  getSnapshot: (householdId?: string) => {
    revision: number;
    state: AppState | null;
    updatedAt: string | null;
    updatedBy?: { memberId: string; memberName: string } | null;
    activity: ActivityEntry[];
    household?: HouseholdRecord | null;
  };
  updateSnapshot: (input: {
    householdId?: string;
    baseRevision: number;
    state: AppState;
    actor?: { memberId?: string; memberName?: string; memberAvatar?: string };
    auditEntry?: { action?: string; summary?: string; entityType?: string };
    force?: boolean;
  }) =>
    | {
        conflict: true;
        snapshot: {
          revision: number;
          state: AppState | null;
          updatedAt: string | null;
          activity: ActivityEntry[];
        };
      }
    | {
        conflict: false;
        revision: number;
        updatedAt: string;
        activity: ActivityEntry[];
      };
  saveReceipt: (receipt: Record<string, unknown>, householdId?: string) => void;
  getReceipt: (id: string, householdId?: string) => Record<string, unknown> | null;
  listReceiptsMeta: (householdId?: string) => Array<Record<string, unknown>>;
  deleteReceipt: (id: string, householdId?: string) => void;
  createUser: (input: {
    name: string;
    email: string;
    password: string;
    role: string;
    memberId: string;
    avatar: string;
    householdName?: string;
    planTier?: string;
    inviteCode?: string;
  }) =>
    | { exists: true; invalidInvite?: undefined; session?: undefined }
    | { invalidInvite: true; exists?: undefined; session?: undefined }
    | { exists: false; invalidInvite?: undefined; session: AuthSessionPayload };
  verifyUserLogin: (email: string, password: string) => AuthSessionPayload | null;
  rotateUserPassword: (
    userId: string,
    currentPassword: string,
    nextPassword: string
  ) => { ok: true } | { ok: false; error: string };
  createPasswordResetToken: (
    email: string,
    ttlMinutes?: number
  ) => { token: string; email: string; name: string; expiresAt: string } | null;
  consumePasswordResetToken: (input: {
    token: string;
    newPassword: string;
  }) => { ok: true } | { ok: false; error: string };
  upsertGoogleUser: (input: UpsertGoogleUserInput) => UpsertGoogleUserResult;
  saveFeedback: (input: Record<string, unknown>) => { id: string; createdAt: string };
  listFeedback: (householdId: string) => Array<Record<string, unknown>>;
  createSession: (input: {
    userId: string;
    householdId: string;
    role: string;
    ttlDays?: number;
  }) => { token: string; expiresAt: string };
  getSessionByToken: (rawToken: string) => Record<string, unknown> | null;
  deleteSessionByToken: (rawToken: string) => void;
  createInvite: (input: {
    householdId: string;
    role: string;
    invitedEmail?: string | null;
    createdByUserId: string;
    ttlHours?: number;
  }) => InviteRecord;
  getInviteByCode: (code: string) => InviteRecord | null;
  listInvites: (householdId: string) => Array<Record<string, unknown>>;
  deleteHouseholdCascade: (householdId: string) => boolean;
  close: () => void;
}

export function createSyncDatabase(dbPath: string): SyncDatabase;
