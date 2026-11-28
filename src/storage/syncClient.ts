import type {
  AccountRole,
  ActivityEntry,
  ActivityEntityType,
  AppState,
  AuthSession,
  CurrencyCode,
  PlanTier,
  ReceiptRecord,
} from '../types/finance';

export interface SyncClientConfig {
  serverUrl?: string;
  syncKey?: string;
  authToken?: string;
}

export interface ServerInvoice {
  id: string;
  householdId: string;
  provider: string;
  providerPaymentId?: string;
  providerOrderId?: string;
  planTier: PlanTier;
  billingCycle: 'monthly' | 'yearly';
  currency: CurrencyCode;
  amountMinor: number;
  gstNumber?: string | null;
  status: string;
  createdAt: string;
}

export interface ServerInvite {
  code: string;
  role: AccountRole;
  invitedEmail?: string | null;
  expiresAt: string;
  usedAt?: string | null;
  createdAt?: string;
}

export interface ServerSnapshotResponse {
  revision: number;
  state: AppState | null;
  updatedAt: string | null;
  activity: ActivityEntry[];
  household?: {
    id: string;
    name: string;
    planTier: PlanTier;
    planStatus: 'active' | 'trialing' | 'past_due' | 'canceled';
    trialEndsAt?: string | null;
    planExpiresAt?: string | null;
  } | null;
}

export type PushStateResponse =
  | {
      ok: true;
      conflict: false;
      revision: number;
      updatedAt: string;
      activity: ActivityEntry[];
    }
  | {
      ok: false;
      conflict: true;
      serverRevision: number;
      serverState: AppState | null;
      updatedAt: string | null;
      activity: ActivityEntry[];
    };

function buildBaseUrl(serverUrl?: string): string {
  const trimmed = (serverUrl ?? '').trim().replace(/\/+$/, '');
  return trimmed;
}

function buildHeaders(config: SyncClientConfig): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.syncKey?.trim()) {
    headers['X-Household-Sync-Key'] = config.syncKey.trim();
  }
  if (config.authToken?.trim()) {
    headers['Authorization'] = `Bearer ${config.authToken.trim()}`;
  }
  return headers;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 3000
): Promise<Response> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      cache: 'no-store',
      credentials: 'include',
      ...init,
      signal: controller.signal,
    });
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export interface SyncHealthDetails {
  available: boolean;
  revision?: number;
  unauthorized?: boolean;
  googleOAuthConfigured?: boolean;
}

export async function fetchSyncHealthDetails(
  config: SyncClientConfig = {}
): Promise<SyncHealthDetails> {
  if (typeof fetch === 'undefined') return { available: false };
  try {
    const base = buildBaseUrl(config.serverUrl);
    const res = await fetchWithTimeout(
      `${base}/api/health`,
      { headers: buildHeaders(config) },
      1400
    );
    if (res.status === 401) return { available: false, unauthorized: true };
    if (!res.ok) return { available: false };
    const data = (await res.json()) as {
      ok?: boolean;
      revision?: number;
      googleOAuthConfigured?: boolean;
    };
    return {
      available: Boolean(data.ok),
      revision: data.revision ?? 0,
      googleOAuthConfigured: Boolean(data.googleOAuthConfigured),
    };
  } catch {
    return { available: false };
  }
}

export async function checkSyncHealth(
  config: SyncClientConfig = {}
): Promise<{ available: boolean; revision?: number; unauthorized?: boolean }> {
  const details = await fetchSyncHealthDetails(config);
  if (details.unauthorized) return { available: false, unauthorized: true };
  if (!details.available) return { available: false };
  return { available: true, revision: details.revision ?? 0 };
}

export async function fetchServerState(
  config: SyncClientConfig = {}
): Promise<ServerSnapshotResponse | null> {
  try {
    const base = buildBaseUrl(config.serverUrl);
    const res = await fetchWithTimeout(`${base}/api/state`, {
      headers: buildHeaders(config),
    });
    if (!res.ok) return null;
    return (await res.json()) as ServerSnapshotResponse;
  } catch {
    return null;
  }
}

export async function pushServerState(
  config: SyncClientConfig,
  params: {
    baseRevision: number;
    state: AppState;
    actor?: { memberId: string; memberName: string; memberAvatar: string };
    auditEntry?: { action: string; summary: string; entityType: ActivityEntityType };
    clientId?: string;
    force?: boolean;
  }
): Promise<PushStateResponse | null> {
  try {
    const base = buildBaseUrl(config.serverUrl);
    const res = await fetchWithTimeout(
      `${base}/api/state`,
      {
        method: 'PUT',
        headers: buildHeaders(config),
        body: JSON.stringify(params),
      },
      5000
    );

    if (res.status === 409) {
      const data = (await res.json()) as {
        serverRevision: number;
        serverState: AppState | null;
        updatedAt: string | null;
        activity: ActivityEntry[];
      };
      return {
        ok: false,
        conflict: true,
        serverRevision: data.serverRevision,
        serverState: data.serverState,
        updatedAt: data.updatedAt,
        activity: data.activity ?? [],
      };
    }

    if (!res.ok) return null;
    const data = (await res.json()) as {
      revision: number;
      updatedAt: string;
      activity: ActivityEntry[];
    };
    return {
      ok: true,
      conflict: false,
      revision: data.revision,
      updatedAt: data.updatedAt,
      activity: data.activity ?? [],
    };
  } catch {
    return null;
  }
}

export async function pushServerReceipt(
  config: SyncClientConfig,
  receipt: ReceiptRecord
): Promise<boolean> {
  try {
    const base = buildBaseUrl(config.serverUrl);
    const res = await fetchWithTimeout(
      `${base}/api/receipts/${encodeURIComponent(receipt.id)}`,
      {
        method: 'PUT',
        headers: buildHeaders(config),
        body: JSON.stringify(receipt),
      },
      6000
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchServerReceipt(
  config: SyncClientConfig,
  receiptId: string
): Promise<ReceiptRecord | null> {
  try {
    const base = buildBaseUrl(config.serverUrl);
    const res = await fetchWithTimeout(
      `${base}/api/receipts/${encodeURIComponent(receiptId)}`,
      { headers: buildHeaders(config) },
      5000
    );
    if (!res.ok) return null;
    return (await res.json()) as ReceiptRecord;
  } catch {
    return null;
  }
}

export async function deleteServerReceipt(
  config: SyncClientConfig,
  receiptId: string
): Promise<boolean> {
  try {
    const base = buildBaseUrl(config.serverUrl);
    const res = await fetchWithTimeout(
      `${base}/api/receipts/${encodeURIComponent(receiptId)}`,
      {
        method: 'DELETE',
        headers: buildHeaders(config),
      },
      3000
    );
    return res.ok;
  } catch {
    return false;
  }
}

export function subscribeToSyncEvents(
  config: SyncClientConfig,
  onRemoteUpdate: (payload: { revision: number; clientId?: string | null; actorName?: string | null }) => void
): () => void {
  if (typeof EventSource === 'undefined' || config.syncKey?.trim()) {
    return () => {};
  }
  const base = buildBaseUrl(config.serverUrl);
  const source = new EventSource(`${base}/api/events`, { withCredentials: true });
  const listener = (evt: MessageEvent) => {
    try {
      const parsed = JSON.parse(evt.data) as {
        revision: number;
        clientId?: string | null;
        actorName?: string | null;
      };
      onRemoteUpdate(parsed);
    } catch {
      // ignore malformed SSE event
    }
  };
  source.addEventListener('state_updated', listener as EventListener);
  return () => {
    source.removeEventListener('state_updated', listener as EventListener);
    source.close();
  };
}

export interface AuthStatusResponse {
  authenticated: boolean;
  session: AuthSession | null;
  googleOAuthConfigured: boolean;
}

export async function fetchAuthStatus(
  config: SyncClientConfig = {}
): Promise<AuthStatusResponse | null> {
  if (typeof fetch === 'undefined') return null;
  try {
    const base = buildBaseUrl(config.serverUrl);
    const res = await fetchWithTimeout(`${base}/api/auth/me`, {
      headers: buildHeaders(config),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      authenticated?: boolean;
      session?: AuthSession | null;
      googleOAuthConfigured?: boolean;
    };
    const authenticated = Boolean(data.authenticated && data.session);
    return {
      authenticated,
      session: authenticated && data.session ? data.session : null,
      googleOAuthConfigured: Boolean(data.googleOAuthConfigured),
    };
  } catch {
    return null;
  }
}

export async function fetchCurrentAuthSession(
  config: SyncClientConfig = {}
): Promise<AuthSession | null> {
  const status = await fetchAuthStatus(config);
  return status?.session ?? null;
}

export function buildGoogleOAuthStartUrl(params: {
  serverUrl?: string;
  mode?: 'signin' | 'signup';
  inviteCode?: string;
  plan?: PlanTier;
} = {}): string {
  const base = buildBaseUrl(params.serverUrl);
  const search = new URLSearchParams();
  if (params.mode === 'signup' || params.mode === 'signin') {
    search.set('mode', params.mode);
  } else {
    search.set('mode', 'signin');
  }
  const cleanInvite = params.inviteCode?.trim();
  if (cleanInvite) {
    search.set('invite', cleanInvite);
  }
  if (params.plan === 'plus' || params.plan === 'advisor') {
    search.set('plan', params.plan);
  }
  const qs = search.toString();
  return `${base}/api/auth/google/start${qs ? `?${qs}` : ''}`;
}

export async function createServerInvite(
  config: SyncClientConfig,
  params: { role: 'partner' | 'dependent' | 'advisor'; email?: string }
): Promise<{ invite?: ServerInvite; inviteUrl?: string; error?: string } | null> {
  try {
    const base = buildBaseUrl(config.serverUrl);
    const res = await fetchWithTimeout(`${base}/api/invites`, {
      method: 'POST',
      headers: buildHeaders(config),
      body: JSON.stringify(params),
    });
    if (res.status === 503 || res.status === 404) return null;
    const data = (await res.json()) as {
      ok?: boolean;
      invite?: ServerInvite;
      inviteUrl?: string;
      error?: string;
    };
    if (!res.ok) return { error: data.error || 'INVITE_FAILED' };
    return { invite: data.invite, inviteUrl: data.inviteUrl };
  } catch {
    return null;
  }
}

export async function listServerInvites(
  config: SyncClientConfig
): Promise<ServerInvite[] | null> {
  try {
    const base = buildBaseUrl(config.serverUrl);
    const res = await fetchWithTimeout(`${base}/api/invites`, { headers: buildHeaders(config) });
    if (!res.ok) return null;
    const data = (await res.json()) as { invites?: ServerInvite[] };
    return data.invites ?? [];
  } catch {
    return null;
  }
}

export async function inspectServerInvite(
  code: string,
  config: SyncClientConfig = {}
): Promise<{ code: string; householdName: string; role: AccountRole; invitedEmail?: string | null } | null> {
  try {
    const base = buildBaseUrl(config.serverUrl);
    const res = await fetchWithTimeout(
      `${base}/api/invites/${encodeURIComponent(code.trim())}`,
      { headers: buildHeaders(config) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      ok?: boolean;
      invite?: { code: string; householdName: string; role: AccountRole; invitedEmail?: string | null };
    };
    return data.invite ?? null;
  } catch {
    return null;
  }
}

export async function createBillingCheckout(
  config: SyncClientConfig,
  params: {
    tier: 'plus' | 'advisor';
    billingCycle: 'monthly' | 'yearly';
    currency: 'INR' | 'USD';
    gstNumber?: string;
    promoCode?: string;
  }
): Promise<{
  checkout?: {
    provider: 'razorpay' | 'stripe';
    mode: 'live' | 'sandbox';
    keyId?: string;
    orderId?: string;
    sessionId?: string;
    checkoutUrl?: string;
    amountMinor: number;
    currency: 'INR' | 'USD';
    tier: 'plus' | 'advisor';
    billingCycle: 'monthly' | 'yearly';
    planName: string;
    promoCode?: string;
  };
  error?: string;
} | null> {
  try {
    const base = buildBaseUrl(config.serverUrl);
    const res = await fetchWithTimeout(
      `${base}/api/billing/checkout`,
      {
        method: 'POST',
        headers: buildHeaders(config),
        body: JSON.stringify(params),
      },
      6000
    );
    if (!res.headers.get('content-type')?.includes('json')) return null;
    const data = (await res.json()) as { checkout?: any; error?: string };
    if (!res.ok) return { error: data.error || 'CHECKOUT_FAILED' };
    return { checkout: data.checkout };
  } catch {
    return null;
  }
}

export async function startServerTrial(
  config: SyncClientConfig
): Promise<{ ok: boolean; error?: string; trialEndsAt?: string } | null> {
  try {
    const base = buildBaseUrl(config.serverUrl);
    const res = await fetchWithTimeout(`${base}/api/billing/trial`, {
      method: 'POST',
      headers: buildHeaders(config),
      body: '{}',
    });
    if (!res.headers.get('content-type')?.includes('json')) return null;
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      household?: { trialEndsAt?: string };
    };
    if (!res.ok) return { ok: false, error: data.error || 'TRIAL_FAILED' };
    return { ok: true, trialEndsAt: data.household?.trialEndsAt };
  } catch {
    return null;
  }
}

export async function verifyRazorpayCheckout(
  config: SyncClientConfig,
  params: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    tier: 'plus' | 'advisor';
    billingCycle: 'monthly' | 'yearly';
    gstNumber?: string;
  }
): Promise<{ ok: boolean; error?: string } | null> {
  try {
    const base = buildBaseUrl(config.serverUrl);
    const res = await fetchWithTimeout(`${base}/api/billing/razorpay/verify`, {
      method: 'POST',
      headers: buildHeaders(config),
      body: JSON.stringify(params),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    return { ok: Boolean(res.ok && data.ok), error: data.error };
  } catch {
    return null;
  }
}

export async function completeSandboxCheckout(
  config: SyncClientConfig,
  params: {
    orderId?: string;
    tier: 'plus' | 'advisor';
    billingCycle: 'monthly' | 'yearly';
    currency: 'INR' | 'USD';
    gstNumber?: string;
  }
): Promise<{ ok: boolean; error?: string } | null> {
  try {
    const base = buildBaseUrl(config.serverUrl);
    const res = await fetchWithTimeout(`${base}/api/billing/sandbox/complete`, {
      method: 'POST',
      headers: buildHeaders(config),
      body: JSON.stringify(params),
    });
    if (res.status === 404 || res.status === 503) return null;
    const data = (await res.json()) as { ok?: boolean; error?: string };
    return { ok: Boolean(res.ok && data.ok), error: data.error };
  } catch {
    return null;
  }
}

export async function fetchBillingHistory(
  config: SyncClientConfig
): Promise<{ invoices: ServerInvoice[]; household?: ServerSnapshotResponse['household'] } | null> {
  try {
    const base = buildBaseUrl(config.serverUrl);
    const res = await fetchWithTimeout(`${base}/api/billing/invoices`, {
      headers: buildHeaders(config),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      invoices?: ServerInvoice[];
      household?: ServerSnapshotResponse['household'];
    };
    return { invoices: data.invoices ?? [], household: data.household };
  } catch {
    return null;
  }
}

export async function validatePromoCode(
  config: SyncClientConfig,
  params: {
    tier: 'plus' | 'advisor';
    billingCycle: 'monthly' | 'yearly';
    currency: 'INR' | 'USD';
    promoCode: string;
  }
): Promise<{
  valid: boolean;
  code?: string;
  discountPct?: number;
  finalAmountMinor?: number;
  label?: string;
  error?: string;
} | null> {
  try {
    const base = buildBaseUrl(config.serverUrl);
    const res = await fetchWithTimeout(`${base}/api/billing/validate-promo`, {
      method: 'POST',
      headers: buildHeaders(config),
      body: JSON.stringify(params),
    });
    if (!res.headers.get('content-type')?.includes('json')) return null;
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      promo?: {
        code: string;
        discountPct: number;
        finalAmountMinor: number;
        label?: string;
      };
    };
    if (!res.ok || !data.promo) return { valid: false, error: data.error || 'INVALID_PROMO_CODE' };
    return {
      valid: true,
      code: data.promo.code,
      discountPct: data.promo.discountPct,
      finalAmountMinor: data.promo.finalAmountMinor,
      label: data.promo.label,
    };
  } catch {
    return null;
  }
}

export async function requestPasswordReset(
  email: string,
  config: SyncClientConfig = {}
): Promise<{ ok: boolean; delivery?: string; error?: string } | null> {
  try {
    const base = buildBaseUrl(config.serverUrl);
    const res = await fetchWithTimeout(`${base}/api/auth/forgot-password`, {
      method: 'POST',
      headers: buildHeaders(config),
      body: JSON.stringify({ email }),
    });
    if (!res.headers.get('content-type')?.includes('json')) return null;
    const data = (await res.json()) as { ok?: boolean; delivery?: string; error?: string };
    return { ok: Boolean(res.ok && data.ok), delivery: data.delivery, error: data.error };
  } catch {
    return null;
  }
}

export async function confirmPasswordReset(
  params: { token: string; newPassword: string },
  config: SyncClientConfig = {}
): Promise<{ ok: boolean; error?: string } | null> {
  try {
    const base = buildBaseUrl(config.serverUrl);
    const res = await fetchWithTimeout(`${base}/api/auth/reset-password`, {
      method: 'POST',
      headers: buildHeaders(config),
      body: JSON.stringify(params),
    });
    if (!res.headers.get('content-type')?.includes('json')) return null;
    const data = (await res.json()) as { ok?: boolean; error?: string };
    return { ok: Boolean(res.ok && data.ok), error: data.error };
  } catch {
    return null;
  }
}

export async function submitFeedback(
  config: SyncClientConfig,
  params: {
    category: string;
    message: string;
    pageView?: string;
    email?: string;
    name?: string;
  }
): Promise<{ ok: boolean; id?: string; error?: string } | null> {
  try {
    const base = buildBaseUrl(config.serverUrl);
    const res = await fetchWithTimeout(`${base}/api/feedback`, {
      method: 'POST',
      headers: buildHeaders(config),
      body: JSON.stringify(params),
    });
    if (!res.headers.get('content-type')?.includes('json')) return null;
    const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
    return { ok: Boolean(res.ok && data.ok), id: data.id, error: data.error };
  } catch {
    return null;
  }
}
