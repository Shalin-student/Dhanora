import type { ActivityEntry, AppState } from '../../src/types/finance';
import type {
  AuthSessionPayload,
  HouseholdRecord,
  InviteRecord,
  PendingOrderRecord,
  UpsertGoogleUserInput,
  UpsertGoogleUserResult,
} from '../db.mjs';

export interface D1Store {
  getHousehold: (householdId: string) => Promise<HouseholdRecord | null>;
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
  ) => Promise<HouseholdRecord | null>;
  recordInvoice: (invoice: Record<string, unknown>) => Promise<string>;
  listInvoices: (householdId: string) => Promise<Array<Record<string, unknown>>>;
  savePendingOrder: (order: PendingOrderRecord) => Promise<void>;
  getPendingOrder: (orderId: string) => Promise<PendingOrderRecord | null>;
  getSnapshot: (householdId?: string) => Promise<{
    revision: number;
    state: AppState | null;
    updatedAt: string | null;
    updatedBy?: { memberId: string; memberName: string } | null;
    activity: ActivityEntry[];
    household?: HouseholdRecord | null;
  }>;
  updateSnapshot: (input: {
    householdId?: string;
    baseRevision: number;
    state: AppState;
    actor?: { memberId?: string; memberName?: string; memberAvatar?: string };
    auditEntry?: { action?: string; summary?: string; entityType?: string };
    force?: boolean;
  }) => Promise<
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
      }
  >;
  saveReceipt: (receipt: Record<string, unknown>, householdId?: string) => Promise<void>;
  getReceipt: (id: string, householdId?: string) => Promise<Record<string, unknown> | null>;
  listReceiptsMeta: (householdId?: string) => Promise<Array<Record<string, unknown>>>;
  deleteReceipt: (id: string, householdId?: string) => Promise<void>;
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
  }) => Promise<
    | { exists: true; invalidInvite?: undefined; session?: undefined }
    | { invalidInvite: true; exists?: undefined; session?: undefined }
    | { exists: false; invalidInvite?: undefined; session: AuthSessionPayload }
  >;
  verifyUserLogin: (email: string, password: string) => Promise<AuthSessionPayload | null>;
  rotateUserPassword: (
    userId: string,
    currentPassword: string,
    nextPassword: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  createPasswordResetToken: (
    email: string,
    ttlMinutes?: number
  ) => Promise<{ token: string; email: string; name: string; expiresAt: string } | null>;
  consumePasswordResetToken: (input: {
    token: string;
    newPassword: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  upsertGoogleUser: (input: UpsertGoogleUserInput) => Promise<UpsertGoogleUserResult>;
  saveFeedback: (input: Record<string, unknown>) => Promise<{ id: string; createdAt: string }>;
  listFeedback: (householdId: string) => Promise<Array<Record<string, unknown>>>;
  createSession: (input: {
    userId: string;
    householdId: string;
    role: string;
    ttlDays?: number;
  }) => Promise<{ token: string; expiresAt: string }>;
  getSessionByToken: (rawToken: string) => Promise<Record<string, unknown> | null>;
  deleteSessionByToken: (rawToken: string) => Promise<void>;
  createInvite: (input: {
    householdId: string;
    role: string;
    invitedEmail?: string | null;
    createdByUserId: string;
    ttlHours?: number;
  }) => Promise<InviteRecord>;
  getInviteByCode: (code: string) => Promise<InviteRecord | null>;
  listInvites: (householdId: string) => Promise<Array<Record<string, unknown>>>;
  deleteHouseholdCascade: (householdId: string) => Promise<boolean>;
}

export function ensureD1Schema(db: unknown): Promise<void>;
export function createD1Store(db: unknown): D1Store;
