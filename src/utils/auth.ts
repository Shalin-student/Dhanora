import type { AccountRole, AuthSession, AuthUser, FamilyMember, PlanTier } from '../types/finance';
import { generateSalt, hashPin } from './security';

const USERS_STORAGE_KEY = 'hearthledger_users_v1';
const SESSION_STORAGE_KEY = 'hearthledger_auth_session_v1';
export const DEMO_HOUSEHOLD_ID = 'hh-demo-carter';

export interface DemoAccountPreset {
  email: string;
  password: string;
  name: string;
  role: AccountRole;
  memberId: string;
  householdId: string;
  householdName: string;
  avatar: string;
}

export const DEMO_ACCOUNT_PRESETS: DemoAccountPreset[] = [
  {
    email: 'alex@carter.family',
    password: 'demo-owner-pass',
    name: 'Alex',
    role: 'admin',
    memberId: 'm-alex',
    householdId: DEMO_HOUSEHOLD_ID,
    householdName: 'The Carter Family',
    avatar: '🧑🏽‍💻',
  },
  {
    email: 'maya@carter.family',
    password: 'demo-partner-pass',
    name: 'Maya',
    role: 'partner',
    memberId: 'm-maya',
    householdId: DEMO_HOUSEHOLD_ID,
    householdName: 'The Carter Family',
    avatar: '👩🏽‍🎨',
  },
  {
    email: 'leo@carter.family',
    password: 'demo-dependent-pass',
    name: 'Leo',
    role: 'dependent',
    memberId: 'm-leo',
    householdId: DEMO_HOUSEHOLD_ID,
    householdName: 'The Carter Family',
    avatar: '🧒🏽',
  },
  {
    email: 'meera@advisor.in',
    password: 'demo-advisor-pass',
    name: 'Meera Joshi (Advisor)',
    role: 'advisor',
    memberId: 'm-advisor',
    householdId: DEMO_HOUSEHOLD_ID,
    householdName: 'The Carter Family',
    avatar: '💼',
  },
];

export function roleAvatarFallback(role: AccountRole): string {
  switch (role) {
    case 'admin':
      return '🧑🏽‍💻';
    case 'partner':
      return '👩🏽‍🎨';
    case 'dependent':
      return '🧒🏽';
    case 'advisor':
      return '💼';
  }
}

export function loadRegisteredUsers(): AuthUser[] {
  try {
    const raw =
      typeof localStorage !== 'undefined' ? localStorage.getItem(USERS_STORAGE_KEY) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AuthUser[]) : [];
  } catch {
    return [];
  }
}

function saveRegisteredUsers(users: AuthUser[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    }
  } catch {
    // ignore storage limits
  }
}

export function loadAuthSession(): AuthSession | null {
  try {
    const raw =
      typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_STORAGE_KEY) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (parsed && parsed.userId && parsed.role) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function persistAuthSession(session: AuthSession | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (!session) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    // ignore
  }
}

export function evaluatePasswordStrength(password: string): {
  score: 0 | 1 | 2 | 3 | 4;
  labelKey: 'auth.pwWeak' | 'auth.pwFair' | 'auth.pwGood' | 'auth.pwStrong';
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score++;

  if (score >= 4) return { score: 4, labelKey: 'auth.pwStrong' };
  if (score === 3) return { score: 3, labelKey: 'auth.pwGood' };
  if (score === 2) return { score: 2, labelKey: 'auth.pwFair' };
  return { score: Math.min(1, password.length > 0 ? 1 : 0) as 0 | 1, labelKey: 'auth.pwWeak' };
}

async function tryServerAuth(
  endpoint: '/api/auth/signup' | '/api/auth/login',
  payload: Record<string, unknown>
): Promise<{ session?: AuthSession; error?: string } | null> {
  if (typeof fetch !== 'function') return null;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status === 503 || res.status === 404) return null;
    const data = (await res.json()) as { ok?: boolean; error?: string; session?: AuthSession };
    if (!res.ok) return { error: data.error || 'AUTH_FAILED' };
    return { session: data.session };
  } catch {
    return null;
  }
}

export async function logoutFromServer(authToken?: string): Promise<void> {
  if (typeof fetch !== 'function') return;
  try {
    const headers: Record<string, string> = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers,
    });
  } catch {
    // ignore offline errors
  }
}

export async function deleteAccountFromServer(authToken?: string): Promise<boolean> {
  if (typeof fetch !== 'function') return false;
  try {
    const headers: Record<string, string> = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch('/api/account', {
      method: 'DELETE',
      credentials: 'include',
      headers,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function signUpAccount(options: {
  name: string;
  email: string;
  password: string;
  role: AccountRole;
  householdName?: string;
  planTier?: PlanTier;
  inviteCode?: string;
  existingMembers?: FamilyMember[];
  syncWithServer?: boolean;
}): Promise<{
  ok: boolean;
  session?: AuthSession;
  newMember?: FamilyMember;
  joinedExistingHousehold?: boolean;
  errorKey?: string;
}> {
  const cleanEmail = options.email.trim().toLowerCase();
  const cleanName = options.name.trim();
  const cleanInvite = options.inviteCode?.trim() || '';
  if (!cleanName || !cleanEmail.includes('@') || options.password.length < 6) {
    return { ok: false, errorKey: 'auth.errInvalidFields' };
  }

  const users = loadRegisteredUsers();
  if (
    users.some((u) => u.email === cleanEmail) ||
    DEMO_ACCOUNT_PRESETS.some((p) => p.email === cleanEmail)
  ) {
    return { ok: false, errorKey: 'auth.errEmailExists' };
  }

  const matchedMember = cleanInvite
    ? (options.existingMembers ?? []).find(
        (m) => m.role === options.role && m.name.toLowerCase() === cleanName.toLowerCase()
      )
    : undefined;
  const memberId = matchedMember?.id ?? `m-usr-${Date.now()}`;
  const avatar = matchedMember?.avatar ?? roleAvatarFallback(options.role);

  const newMember: FamilyMember | undefined = matchedMember
    ? undefined
    : {
        id: memberId,
        name: cleanName,
        role: options.role,
        avatar,
        color: options.role === 'advisor' ? '#0ea5e9' : '#10b981',
        monthlyAllowance: options.role === 'dependent' ? 250 : 1500,
      };

  let householdId = cleanInvite
    ? DEMO_HOUSEHOLD_ID
    : `hh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  let resolvedRole: AccountRole = options.role;
  let resolvedHouseholdName =
    options.householdName?.trim() || `${cleanName}'s Household`;
  let serverToken: string | undefined;
  let joinedExisting = Boolean(cleanInvite);

  if (options.syncWithServer) {
    const serverRes = await tryServerAuth('/api/auth/signup', {
      name: cleanName,
      email: cleanEmail,
      password: options.password,
      role: options.role,
      memberId,
      avatar,
      householdName: resolvedHouseholdName,
      planTier: options.planTier ?? 'free',
      inviteCode: cleanInvite || undefined,
    });
    if (serverRes?.error === 'EMAIL_EXISTS') {
      return { ok: false, errorKey: 'auth.errEmailExists' };
    }
    if (serverRes?.error === 'INVITE_INVALID_OR_EXPIRED') {
      return { ok: false, errorKey: 'auth.errInvalidInvite' };
    }
    if (serverRes?.session) {
      householdId = serverRes.session.householdId || householdId;
      resolvedRole = serverRes.session.role;
      resolvedHouseholdName = serverRes.session.householdName || resolvedHouseholdName;
      serverToken = serverRes.session.token;
      joinedExisting = Boolean(cleanInvite);
    }
  }

  const salt = generateSalt();
  const passwordHash = await hashPin(options.password, salt);
  const user: AuthUser = {
    id: `usr-${Date.now()}`,
    householdId,
    householdName: resolvedHouseholdName,
    name: cleanName,
    email: cleanEmail,
    role: resolvedRole,
    memberId,
    avatar,
    passwordHash,
    passwordSalt: salt,
    createdAt: new Date().toISOString(),
  };

  saveRegisteredUsers([...users, user]);
  const session: AuthSession = {
    token: serverToken || `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: user.id,
    householdId,
    householdName: resolvedHouseholdName,
    name: user.name,
    email: user.email,
    role: user.role,
    memberId: user.memberId,
    avatar: user.avatar,
    planTier: options.planTier ?? 'free',
    isDemo: false,
  };
  persistAuthSession(session);
  return {
    ok: true,
    session,
    newMember,
    joinedExistingHousehold: joinedExisting,
  };
}

export async function signInAccount(options: {
  email: string;
  password: string;
  syncWithServer?: boolean;
}): Promise<{ ok: boolean; session?: AuthSession; errorKey?: string }> {
  const cleanEmail = options.email.trim().toLowerCase();
  if (!cleanEmail || !options.password) {
    return { ok: false, errorKey: 'auth.errInvalidCreds' };
  }

  // 1. Check built-in demo personas cleanly
  const demo = DEMO_ACCOUNT_PRESETS.find((p) => p.email === cleanEmail);
  if (demo) {
    if (options.password !== demo.password) {
      return { ok: false, errorKey: 'auth.errInvalidCreds' };
    }
    const session: AuthSession = {
      token: `demo-${Date.now()}`,
      userId: `demo-${demo.role}`,
      householdId: demo.householdId,
      householdName: demo.householdName,
      name: demo.name,
      email: demo.email,
      role: demo.role,
      memberId: demo.memberId,
      avatar: demo.avatar,
      isDemo: true,
    };
    persistAuthSession(session);
    return { ok: true, session };
  }

  // 2. Prefer server authentication when SQLite backend is active so HttpOnly cookie & server household state stay authoritative
  if (options.syncWithServer) {
    const remote = await tryServerAuth('/api/auth/login', {
      email: cleanEmail,
      password: options.password,
    });
    if (remote?.session) {
      persistAuthSession(remote.session);
      return { ok: true, session: remote.session };
    }
    if (remote?.error === 'INVALID_CREDENTIALS') {
      // Fall through only if a locally-created user wasn't pushed while offline
    }
  }

  // 3. Offline / client-only fallback check with salted SHA-256 hash verification
  const users = loadRegisteredUsers();
  const user = users.find((u) => u.email === cleanEmail);
  if (user && user.passwordHash && user.passwordSalt) {
    const candidateHash = await hashPin(options.password, user.passwordSalt);
    if (candidateHash !== user.passwordHash) {
      return { ok: false, errorKey: 'auth.errInvalidCreds' };
    }
    const session: AuthSession = {
      token: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: user.id,
      householdId: user.householdId || `hh-${user.id}`,
      householdName: user.householdName,
      name: user.name,
      email: user.email,
      role: user.role,
      memberId: user.memberId,
      avatar: user.avatar,
      isDemo: false,
    };
    persistAuthSession(session);
    return { ok: true, session };
  }

  return { ok: false, errorKey: 'auth.errInvalidCreds' };
}

export function createGuestDemoSession(presetIndex = 0): AuthSession {
  const preset = DEMO_ACCOUNT_PRESETS[presetIndex] ?? DEMO_ACCOUNT_PRESETS[0];
  const session: AuthSession = {
    token: `demo-${Date.now()}`,
    userId: `demo-${preset.role}`,
    householdId: preset.householdId,
    householdName: preset.householdName,
    name: preset.name,
    email: preset.email,
    role: preset.role,
    memberId: preset.memberId,
    avatar: preset.avatar,
    isDemo: true,
  };
  persistAuthSession(session);
  return session;
}
