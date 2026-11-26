import { randomHex, safeHexEqual, sha256Hex } from './billingCore.mjs';

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS households (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    plan_tier TEXT NOT NULL DEFAULT 'free',
    plan_status TEXT NOT NULL DEFAULT 'active',
    billing_cycle TEXT NOT NULL DEFAULT 'yearly',
    trial_ends_at TEXT,
    plan_expires_at TEXT,
    billing_provider TEXT,
    external_customer_id TEXT,
    external_subscription_id TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS household_state (
    id TEXT PRIMARY KEY,
    revision INTEGER NOT NULL DEFAULT 0,
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by_member_id TEXT,
    updated_by_name TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS receipts (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL DEFAULT 'default',
    tx_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    data_url TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL DEFAULT 'default',
    member_id TEXT NOT NULL,
    member_name TEXT NOT NULL,
    member_avatar TEXT NOT NULL,
    action TEXT NOT NULL,
    summary TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL DEFAULT 'default',
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    member_id TEXT NOT NULL,
    avatar TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    household_id TEXT NOT NULL,
    role TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS invites (
    code TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    role TEXT NOT NULL,
    invited_email TEXT,
    created_by_user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_by_user_id TEXT,
    used_at TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS billing_invoices (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_payment_id TEXT UNIQUE,
    provider_order_id TEXT,
    plan_tier TEXT NOT NULL,
    billing_cycle TEXT NOT NULL,
    currency TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    gst_number TEXT,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS billing_orders (
    order_id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    plan_tier TEXT NOT NULL,
    billing_cycle TEXT NOT NULL,
    currency TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS feedback_messages (
    id TEXT PRIMARY KEY,
    household_id TEXT,
    user_id TEXT,
    user_email TEXT,
    user_name TEXT,
    category TEXT NOT NULL,
    message TEXT NOT NULL,
    page_view TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_receipts_tx ON receipts (tx_id)`,
  `CREATE INDEX IF NOT EXISTS idx_receipts_hh ON receipts (household_id, tx_id)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log (household_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)`,
  `CREATE INDEX IF NOT EXISTS idx_users_hh ON users (household_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_invites_hh ON invites (household_id)`,
  `CREATE INDEX IF NOT EXISTS idx_invoices_hh ON billing_invoices (household_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_hh ON billing_orders (household_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_resets_email ON password_resets (email, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_feedback_hh ON feedback_messages (household_id, created_at DESC)`,
];

const initializedDbs = new WeakMap();

export async function ensureD1Schema(db) {
  let promise = initializedDbs.get(db);
  if (!promise) {
    promise = (async () => {
      const statements = [
        ...DDL_STATEMENTS.map((sql) => db.prepare(sql)),
        db
          .prepare(
            `INSERT INTO households (id, name, plan_tier, plan_status, created_at)
             VALUES (?, ?, 'free', 'active', ?)
             ON CONFLICT(id) DO NOTHING`
          )
          .bind('default', 'Shared Household', new Date().toISOString()),
      ];
      await db.batch(statements);
    })().catch((err) => {
      initializedDbs.delete(db);
      throw err;
    });
    initializedDbs.set(db, promise);
  }
  await promise;
}

function nowIso() {
  return new Date().toISOString();
}

async function hashUserPassword(password, salt) {
  return sha256Hex(`${salt}:${password}`);
}

function stripInlineReceipts(state) {
  if (!state || !Array.isArray(state.transactions)) return state;
  return {
    ...state,
    transactions: state.transactions.map((tx) => {
      if (!tx || !tx.receiptDataUrl) return tx;
      const { receiptDataUrl: _omitted, ...rest } = tx;
      return rest;
    }),
  };
}

function buildSessionPayload(row, token) {
  return {
    token,
    userId: row.userId ?? row.id,
    householdId: row.householdId,
    householdName: row.householdName,
    name: row.name,
    email: row.email,
    role: row.role,
    memberId: row.memberId,
    avatar: row.avatar,
    planTier: row.planTier ?? 'free',
    planStatus: row.planStatus ?? 'active',
    trialEndsAt: row.trialEndsAt ?? undefined,
    planExpiresAt: row.planExpiresAt ?? undefined,
    isDemo: false,
  };
}

export function createD1Store(db) {
  async function getHousehold(householdId) {
    return (
      (await db
        .prepare(
          `SELECT id, name, plan_tier AS planTier, plan_status AS planStatus,
                  billing_cycle AS billingCycle, trial_ends_at AS trialEndsAt,
                  plan_expires_at AS planExpiresAt, billing_provider AS billingProvider,
                  created_at AS createdAt
           FROM households WHERE id = ?`
        )
        .bind(householdId)
        .first()) ?? null
    );
  }

  async function listActivity(householdId) {
    const res = await db
      .prepare(
        `SELECT id, member_id AS memberId, member_name AS memberName, member_avatar AS memberAvatar,
                action, summary, entity_type AS entityType, created_at AS createdAt
         FROM activity_log
         WHERE household_id = ?
         ORDER BY created_at DESC, rowid DESC
         LIMIT 100`
      )
      .bind(householdId)
      .all();
    return res.results ?? [];
  }

  async function createSession({ userId, householdId, role, ttlDays = 14 }) {
    const rawToken = randomHex(32);
    const tokenHash = await sha256Hex(rawToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlDays * 86400000).toISOString();
    await db
      .prepare(
        `INSERT INTO sessions (token_hash, user_id, household_id, role, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(tokenHash, userId, householdId, role, expiresAt, now.toISOString())
      .run();
    return { token: rawToken, expiresAt };
  }

  async function getSessionByToken(rawToken) {
    if (!rawToken) return null;
    const tokenHash = await sha256Hex(rawToken);
    const row = await db
      .prepare(
        `SELECT s.user_id AS userId, s.household_id AS householdId, s.role, s.expires_at AS expiresAt,
                u.name, u.email, u.member_id AS memberId, u.avatar,
                h.name AS householdName, h.plan_tier AS planTier, h.plan_status AS planStatus,
                h.billing_cycle AS billingCycle, h.trial_ends_at AS trialEndsAt, h.plan_expires_at AS planExpiresAt
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         JOIN households h ON h.id = s.household_id
         WHERE s.token_hash = ?`
      )
      .bind(tokenHash)
      .first();
    if (!row) return null;
    if (Date.parse(row.expiresAt) < Date.now()) {
      await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
      return null;
    }
    return row;
  }

  async function deleteSessionByToken(rawToken) {
    if (!rawToken) return;
    const tokenHash = await sha256Hex(rawToken);
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
  }

  async function getInviteByCode(code) {
    if (!code) return null;
    const inv = await db
      .prepare(
        `SELECT i.code, i.household_id AS householdId, i.role, i.invited_email AS invitedEmail,
                i.expires_at AS expiresAt, i.used_at AS usedAt, h.name AS householdName
         FROM invites i
         JOIN households h ON h.id = i.household_id
         WHERE i.code = ?`
      )
      .bind(String(code).trim())
      .first();
    if (!inv) return null;
    const expired = Date.parse(inv.expiresAt) < Date.now();
    return {
      ...inv,
      valid: !inv.usedAt && !expired,
      expired,
    };
  }

  async function createUser({
    name,
    email,
    password,
    role,
    memberId,
    avatar,
    householdName,
    planTier = 'free',
    inviteCode,
  }) {
    const cleanEmail = String(email).trim().toLowerCase();
    const existing = await db
      .prepare('SELECT id FROM users WHERE email = ?')
      .bind(cleanEmail)
      .first();
    if (existing) return { exists: true };

    const now = nowIso();
    let targetHouseholdId = `hh-${Date.now()}-${randomHex(3)}`;
    let effectiveRole = ['admin', 'partner', 'dependent', 'advisor'].includes(role) ? role : 'admin';
    const effectivePlan = ['free', 'plus', 'advisor'].includes(planTier) ? planTier : 'free';

    const cleanName = String(name).trim();
    const userId = `usr-${Date.now()}-${randomHex(3)}`;
    const salt = randomHex(16);
    const hash = await hashUserPassword(password, salt);

    const statements = [];
    let usedInviteCode = null;

    if (inviteCode && String(inviteCode).trim()) {
      const inv = await getInviteByCode(String(inviteCode).trim());
      if (!inv || !inv.valid) return { invalidInvite: true };
      if (inv.invitedEmail && inv.invitedEmail.toLowerCase() !== cleanEmail) {
        return { invalidInvite: true };
      }
      targetHouseholdId = inv.householdId;
      effectiveRole = inv.role;
      usedInviteCode = inv.code;
    } else {
      const cleanHhName = String(householdName || '').trim() || `${cleanName}'s Household`;
      const trialEnds =
        effectivePlan === 'plus'
          ? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
          : null;
      const status = effectivePlan === 'plus' ? 'trialing' : 'active';
      statements.push(
        db
          .prepare(
            `INSERT INTO households (id, name, plan_tier, plan_status, billing_cycle, trial_ends_at, created_at)
             VALUES (?, ?, ?, ?, 'yearly', ?, ?)`
          )
          .bind(targetHouseholdId, cleanHhName, effectivePlan, status, trialEnds, now)
      );
    }

    if (usedInviteCode) {
      // Mark invite consumed conditionally BEFORE inserting user in the same batch;
      // if another concurrent request consumed it, detect via changes === 0 and clean up cleanly.
      const invUpdate = await db
        .prepare('UPDATE invites SET used_by_user_id = ?, used_at = ? WHERE code = ? AND used_at IS NULL')
        .bind(userId, now, usedInviteCode)
        .run();
      if (!invUpdate?.meta?.changes) {
        return { invalidInvite: true };
      }
    }

    statements.push(
      db
        .prepare(
          `INSERT INTO users (id, household_id, email, name, role, member_id, avatar, password_hash, password_salt, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(userId, targetHouseholdId, cleanEmail, cleanName, effectiveRole, memberId, avatar, hash, salt, now)
    );

    try {
      await db.batch(statements);
    } catch (err) {
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('unique') && msg.includes('email')) {
        if (usedInviteCode) {
          await db
            .prepare('UPDATE invites SET used_by_user_id = NULL, used_at = NULL WHERE code = ? AND used_by_user_id = ?')
            .bind(usedInviteCode, userId)
            .run();
        }
        return { exists: true };
      }
      throw err;
    }

    const hh = await getHousehold(targetHouseholdId);
    const { token } = await createSession({
      userId,
      householdId: targetHouseholdId,
      role: effectiveRole,
    });

    return {
      exists: false,
      session: buildSessionPayload(
        {
          userId,
          householdId: targetHouseholdId,
          householdName: hh?.name ?? householdName ?? 'Household',
          name: cleanName,
          email: cleanEmail,
          role: effectiveRole,
          memberId,
          avatar,
          planTier: hh?.planTier ?? effectivePlan,
          planStatus: hh?.planStatus ?? 'active',
          trialEndsAt: hh?.trialEndsAt,
          planExpiresAt: hh?.planExpiresAt,
        },
        token
      ),
    };
  }

  async function verifyUserLogin(email, password) {
    const row = await db
      .prepare(
        `SELECT id, household_id AS householdId, email, name, role, member_id AS memberId, avatar,
                password_hash AS passwordHash, password_salt AS passwordSalt
         FROM users WHERE email = ?`
      )
      .bind(String(email).trim().toLowerCase())
      .first();
    if (!row) return null;

    const candidate = await hashUserPassword(password, row.passwordSalt);
    if (!safeHexEqual(candidate, row.passwordHash)) return null;

    const hh = await getHousehold(row.householdId);
    const { token } = await createSession({
      userId: row.id,
      householdId: row.householdId,
      role: row.role,
    });

    return buildSessionPayload(
      {
        userId: row.id,
        householdId: row.householdId,
        householdName: hh?.name ?? 'Household',
        name: row.name,
        email: row.email,
        role: row.role,
        memberId: row.memberId,
        avatar: row.avatar,
        planTier: hh?.planTier ?? 'free',
        planStatus: hh?.planStatus ?? 'active',
        trialEndsAt: hh?.trialEndsAt,
        planExpiresAt: hh?.planExpiresAt,
      },
      token
    );
  }

  async function rotateUserPassword(userId, currentPassword, nextPassword) {
    const row = await db
      .prepare(
        `SELECT id, password_hash AS passwordHash, password_salt AS passwordSalt
         FROM users WHERE id = ?`
      )
      .bind(userId)
      .first();
    if (!row) return { ok: false, error: 'NOT_FOUND' };

    const candidate = await hashUserPassword(currentPassword, row.passwordSalt);
    if (!safeHexEqual(candidate, row.passwordHash)) {
      return { ok: false, error: 'INVALID_CURRENT_PASSWORD' };
    }

    const salt = randomHex(16);
    const hash = await hashUserPassword(nextPassword, salt);
    await db.batch([
      db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').bind(hash, salt, userId),
      db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId),
    ]);
    return { ok: true };
  }

  async function createPasswordResetToken(email, ttlMinutes = 30) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) return null;
    const user = await db
      .prepare('SELECT id, name, email FROM users WHERE email = ?')
      .bind(cleanEmail)
      .first();
    if (!user) return null;

    const rawToken = randomHex(32);
    const tokenHash = await sha256Hex(rawToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60000).toISOString();
    await db
      .prepare(
        `INSERT INTO password_resets (token_hash, user_id, email, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(tokenHash, user.id, user.email, expiresAt, now.toISOString())
      .run();

    return {
      token: rawToken,
      email: user.email,
      name: user.name,
      expiresAt,
    };
  }

  async function consumePasswordResetToken({ token, newPassword }) {
    const cleanToken = String(token || '').trim();
    if (!cleanToken) return { ok: false, error: 'INVALID_OR_EXPIRED_RESET_TOKEN' };
    const tokenHash = await sha256Hex(cleanToken);
    const row = await db
      .prepare(
        `SELECT token_hash AS tokenHash, user_id AS userId, expires_at AS expiresAt, used_at AS usedAt
         FROM password_resets WHERE token_hash = ?`
      )
      .bind(tokenHash)
      .first();
    if (!row || row.usedAt || Date.parse(row.expiresAt) < Date.now()) {
      return { ok: false, error: 'INVALID_OR_EXPIRED_RESET_TOKEN' };
    }

    const now = nowIso();
    const claim = await db
      .prepare(
        'UPDATE password_resets SET used_at = ? WHERE token_hash = ? AND used_at IS NULL'
      )
      .bind(now, tokenHash)
      .run();
    if (!claim?.meta?.changes) {
      return { ok: false, error: 'INVALID_OR_EXPIRED_RESET_TOKEN' };
    }

    const salt = randomHex(16);
    const hash = await hashUserPassword(newPassword, salt);
    await db.batch([
      db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').bind(hash, salt, row.userId),
      db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(row.userId),
    ]);
    return { ok: true };
  }

  async function saveFeedback({ householdId, userId, userEmail, userName, category, message, pageView }) {
    const id = `fb-${Date.now()}-${randomHex(3)}`;
    const now = nowIso();
    await db
      .prepare(
        `INSERT INTO feedback_messages (id, household_id, user_id, user_email, user_name, category, message, page_view, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`
      )
      .bind(
        id,
        householdId ?? null,
        userId ?? null,
        userEmail ?? null,
        userName ?? null,
        String(category || 'general').slice(0, 40),
        String(message || '').trim().slice(0, 4000),
        pageView ?? null,
        now
      )
      .run();
    return { id, createdAt: now };
  }

  async function listFeedback(householdId) {
    if (!householdId) return [];
    const res = await db
      .prepare(
        `SELECT id, category, message, page_view AS pageView, status, created_at AS createdAt
         FROM feedback_messages WHERE household_id = ? ORDER BY created_at DESC LIMIT 20`
      )
      .bind(householdId)
      .all();
    return res.results ?? [];
  }

  async function updateHouseholdBilling(householdId, patch) {
    const cur = await getHousehold(householdId);
    if (!cur) return null;
    const nextTier = patch.planTier ?? cur.planTier;
    const nextStatus = patch.planStatus ?? cur.planStatus;
    const nextCycle = patch.billingCycle ?? cur.billingCycle ?? 'yearly';
    const nextTrialEnds = patch.trialEndsAt !== undefined ? patch.trialEndsAt : cur.trialEndsAt;
    const nextPlanExpires =
      patch.planExpiresAt !== undefined ? patch.planExpiresAt : cur.planExpiresAt;
    const nextProvider =
      patch.billingProvider !== undefined ? patch.billingProvider : cur.billingProvider;

    await db
      .prepare(
        `UPDATE households
         SET plan_tier = ?, plan_status = ?, billing_cycle = ?,
             trial_ends_at = ?, plan_expires_at = ?, billing_provider = ?
         WHERE id = ?`
      )
      .bind(nextTier, nextStatus, nextCycle, nextTrialEnds, nextPlanExpires, nextProvider, householdId)
      .run();

    return getHousehold(householdId);
  }

  async function recordInvoice(invoice) {
    const id = invoice.id ?? `inv-${Date.now()}-${randomHex(3)}`;
    await db
      .prepare(
        `INSERT INTO billing_invoices (
          id, household_id, provider, provider_payment_id, provider_order_id,
          plan_tier, billing_cycle, currency, amount_minor, gst_number, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(provider_payment_id) DO NOTHING`
      )
      .bind(
        id,
        invoice.householdId,
        invoice.provider,
        invoice.providerPaymentId ?? null,
        invoice.providerOrderId ?? null,
        invoice.planTier,
        invoice.billingCycle,
        invoice.currency,
        Number(invoice.amountMinor),
        invoice.gstNumber ?? null,
        invoice.status ?? 'paid',
        invoice.createdAt ?? nowIso()
      )
      .run();
    return id;
  }

  async function listInvoices(householdId) {
    const res = await db
      .prepare(
        `SELECT id, household_id AS householdId, provider, provider_payment_id AS providerPaymentId,
                provider_order_id AS providerOrderId, plan_tier AS planTier, billing_cycle AS billingCycle,
                currency, amount_minor AS amountMinor, gst_number AS gstNumber, status, created_at AS createdAt
         FROM billing_invoices WHERE household_id = ? ORDER BY created_at DESC LIMIT 50`
      )
      .bind(householdId)
      .all();
    return res.results ?? [];
  }

  async function savePendingOrder({
    orderId,
    householdId,
    provider,
    planTier,
    billingCycle,
    currency,
    amountMinor,
  }) {
    if (!orderId) return;
    await db
      .prepare(
        `INSERT INTO billing_orders (order_id, household_id, provider, plan_tier, billing_cycle, currency, amount_minor, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(order_id) DO UPDATE SET
           household_id = excluded.household_id,
           plan_tier = excluded.plan_tier,
           billing_cycle = excluded.billing_cycle`
      )
      .bind(orderId, householdId, provider, planTier, billingCycle, currency, Number(amountMinor), nowIso())
      .run();
  }

  async function getPendingOrder(orderId) {
    if (!orderId) return null;
    return (
      (await db
        .prepare(
          `SELECT order_id AS orderId, household_id AS householdId, provider,
                  plan_tier AS planTier, billing_cycle AS billingCycle,
                  currency, amount_minor AS amountMinor
           FROM billing_orders WHERE order_id = ?`
        )
        .bind(orderId)
        .first()) ?? null
    );
  }

  async function createInvite({ householdId, role, invitedEmail, createdByUserId, ttlHours = 72 }) {
    const validRole = ['partner', 'dependent', 'advisor'].includes(role) ? role : 'partner';
    const code = randomHex(6);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlHours * 3600000).toISOString();
    const cleanInvited = invitedEmail ? String(invitedEmail).trim().toLowerCase() : null;

    await db
      .prepare(
        `INSERT INTO invites (code, household_id, role, invited_email, created_by_user_id, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(code, householdId, validRole, cleanInvited, createdByUserId, expiresAt, now.toISOString())
      .run();

    return {
      code,
      householdId,
      role: validRole,
      invitedEmail: cleanInvited,
      expiresAt,
    };
  }

  async function listInvites(householdId) {
    const res = await db
      .prepare(
        `SELECT code, role, invited_email AS invitedEmail, expires_at AS expiresAt,
                used_at AS usedAt, created_at AS createdAt
         FROM invites WHERE household_id = ? ORDER BY created_at DESC LIMIT 25`
      )
      .bind(householdId)
      .all();
    return res.results ?? [];
  }

  async function deleteHouseholdCascade(householdId) {
    if (!householdId || householdId === 'default') return false;
    await db.batch([
      db.prepare('DELETE FROM sessions WHERE household_id = ?').bind(householdId),
      db
        .prepare(
          'DELETE FROM password_resets WHERE email IN (SELECT email FROM users WHERE household_id = ?)'
        )
        .bind(householdId),
      db.prepare('DELETE FROM invites WHERE household_id = ?').bind(householdId),
      db.prepare('DELETE FROM receipts WHERE household_id = ?').bind(householdId),
      db.prepare('DELETE FROM activity_log WHERE household_id = ?').bind(householdId),
      db.prepare('DELETE FROM billing_invoices WHERE household_id = ?').bind(householdId),
      db.prepare('DELETE FROM billing_orders WHERE household_id = ?').bind(householdId),
      db.prepare('DELETE FROM feedback_messages WHERE household_id = ?').bind(householdId),
      db.prepare('DELETE FROM household_state WHERE id = ?').bind(householdId),
      db.prepare('DELETE FROM users WHERE household_id = ?').bind(householdId),
      db.prepare('DELETE FROM households WHERE id = ?').bind(householdId),
    ]);
    return true;
  }

  async function getSnapshot(householdId = 'default') {
    const hhId = householdId || 'default';
    const row = await db
      .prepare(
        'SELECT revision, state_json, updated_at, updated_by_member_id, updated_by_name FROM household_state WHERE id = ?'
      )
      .bind(hhId)
      .first();
    const activity = await listActivity(hhId);
    const hh = await getHousehold(hhId);
    if (!row) {
      return {
        revision: 0,
        state: null,
        updatedAt: null,
        updatedBy: null,
        activity,
        household: hh,
      };
    }
    const parsedState = JSON.parse(row.state_json);
    if (hh && parsedState?.settings) {
      parsedState.settings.planTier = hh.planTier;
      parsedState.settings.trialEndsAt = hh.trialEndsAt ?? undefined;
    }
    return {
      revision: row.revision,
      state: parsedState,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by_member_id
        ? { memberId: row.updated_by_member_id, memberName: row.updated_by_name }
        : null,
      activity,
      household: hh,
    };
  }

  async function updateSnapshot({
    householdId = 'default',
    baseRevision,
    state,
    actor,
    auditEntry,
    force = false,
  }) {
    const hhId = householdId || 'default';
    const now = nowIso();
    const cleanState = stripInlineReceipts(state);

    await db
      .prepare(
        `INSERT INTO households (id, name, plan_tier, plan_status, created_at)
         VALUES (?, ?, 'free', 'active', ?)
         ON CONFLICT(id) DO NOTHING`
      )
      .bind(hhId, cleanState?.settings?.householdName || 'Household', now)
      .run();

    const hh = await getHousehold(hhId);
    if (hh && cleanState?.settings) {
      cleanState.settings.planTier = hh.planTier;
      cleanState.settings.trialEndsAt = hh.trialEndsAt ?? undefined;
    }

    const current = await db
      .prepare('SELECT revision, state_json, updated_at FROM household_state WHERE id = ?')
      .bind(hhId)
      .first();
    const currentRevision = current ? Number(current.revision) : 0;

    if (!force && currentRevision > 0 && baseRevision !== currentRevision) {
      return {
        conflict: true,
        snapshot: {
          revision: currentRevision,
          state: current ? JSON.parse(current.state_json) : null,
          updatedAt: current ? current.updated_at : null,
          activity: await listActivity(hhId),
        },
      };
    }

    const nextRevision = currentRevision + 1;
    const serialized = JSON.stringify(cleanState);

    if (force) {
      await db
        .prepare(
          `INSERT INTO household_state (id, revision, state_json, updated_at, updated_by_member_id, updated_by_name)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             revision = excluded.revision,
             state_json = excluded.state_json,
             updated_at = excluded.updated_at,
             updated_by_member_id = excluded.updated_by_member_id,
             updated_by_name = excluded.updated_by_name`
        )
        .bind(hhId, nextRevision, serialized, now, actor?.memberId ?? null, actor?.memberName ?? null)
        .run();
    } else if (currentRevision === 0) {
      const insRes = await db
        .prepare(
          `INSERT INTO household_state (id, revision, state_json, updated_at, updated_by_member_id, updated_by_name)
           VALUES (?, 1, ?, ?, ?, ?)
           ON CONFLICT(id) DO NOTHING`
        )
        .bind(hhId, serialized, now, actor?.memberId ?? null, actor?.memberName ?? null)
        .run();
      if (!insRes?.meta?.changes) {
        const latest = await db
          .prepare('SELECT revision, state_json, updated_at FROM household_state WHERE id = ?')
          .bind(hhId)
          .first();
        return {
          conflict: true,
          snapshot: {
            revision: latest ? Number(latest.revision) : 1,
            state: latest ? JSON.parse(latest.state_json) : null,
            updatedAt: latest ? latest.updated_at : null,
            activity: await listActivity(hhId),
          },
        };
      }
    } else {
      const updRes = await db
        .prepare(
          `UPDATE household_state
           SET revision = ?, state_json = ?, updated_at = ?, updated_by_member_id = ?, updated_by_name = ?
           WHERE id = ? AND revision = ?`
        )
        .bind(
          nextRevision,
          serialized,
          now,
          actor?.memberId ?? null,
          actor?.memberName ?? null,
          hhId,
          currentRevision
        )
        .run();
      if (!updRes?.meta?.changes) {
        const latest = await db
          .prepare('SELECT revision, state_json, updated_at FROM household_state WHERE id = ?')
          .bind(hhId)
          .first();
        return {
          conflict: true,
          snapshot: {
            revision: latest ? Number(latest.revision) : currentRevision,
            state: latest ? JSON.parse(latest.state_json) : null,
            updatedAt: latest ? latest.updated_at : null,
            activity: await listActivity(hhId),
          },
        };
      }
    }

    if (auditEntry && auditEntry.summary) {
      const entryId = `act-${Date.now()}-${randomHex(3)}`;
      await db.batch([
        db
          .prepare(
            `INSERT INTO activity_log (id, household_id, member_id, member_name, member_avatar, action, summary, entity_type, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            entryId,
            hhId,
            actor?.memberId ?? 'm-shared',
            actor?.memberName ?? 'Household',
            actor?.memberAvatar ?? '🏡',
            auditEntry.action ?? 'update',
            auditEntry.summary,
            auditEntry.entityType ?? 'sync',
            now
          ),
        db
          .prepare(
            `DELETE FROM activity_log
             WHERE household_id = ? AND id NOT IN (
               SELECT id FROM activity_log WHERE household_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 250
             )`
          )
          .bind(hhId, hhId),
      ]);
    }

    return {
      conflict: false,
      revision: nextRevision,
      updatedAt: now,
      activity: await listActivity(hhId),
    };
  }

  async function saveReceipt(receipt, householdId = 'default') {
    const hhId = householdId || 'default';
    const existing = await db
      .prepare('SELECT household_id AS householdId FROM receipts WHERE id = ?')
      .bind(receipt.id)
      .first();
    if (existing && existing.householdId !== hhId) {
      throw Object.assign(new Error('FORBIDDEN_RECEIPT_CROSS_TENANT'), { statusCode: 403 });
    }
    await db
      .prepare(
        `INSERT INTO receipts (id, household_id, tx_id, file_name, mime_type, size_bytes, data_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           tx_id = excluded.tx_id,
           file_name = excluded.file_name,
           mime_type = excluded.mime_type,
           size_bytes = excluded.size_bytes,
           data_url = excluded.data_url,
           created_at = excluded.created_at
         WHERE receipts.household_id = excluded.household_id`
      )
      .bind(
        receipt.id,
        hhId,
        receipt.txId,
        receipt.fileName,
        receipt.mimeType,
        Number(receipt.sizeBytes || 0),
        receipt.dataUrl,
        receipt.createdAt || nowIso()
      )
      .run();
  }

  async function getReceipt(id, householdId = 'default') {
    const hhId = householdId || 'default';
    return (
      (await db
        .prepare(
          `SELECT id, household_id AS householdId, tx_id AS txId, file_name AS fileName,
                  mime_type AS mimeType, size_bytes AS sizeBytes, data_url AS dataUrl, created_at AS createdAt
           FROM receipts WHERE id = ? AND household_id = ?`
        )
        .bind(id, hhId)
        .first()) ?? null
    );
  }

  async function listReceiptsMeta(householdId = 'default') {
    const res = await db
      .prepare(
        `SELECT id, tx_id AS txId, file_name AS fileName, mime_type AS mimeType,
                size_bytes AS sizeBytes, created_at AS createdAt
         FROM receipts WHERE household_id = ? ORDER BY created_at DESC`
      )
      .bind(householdId || 'default')
      .all();
    return res.results ?? [];
  }

  async function deleteReceipt(id, householdId = 'default') {
    await db
      .prepare('DELETE FROM receipts WHERE id = ? AND household_id = ?')
      .bind(id, householdId || 'default')
      .run();
  }

  return {
    getHousehold,
    updateHouseholdBilling,
    recordInvoice,
    listInvoices,
    savePendingOrder,
    getPendingOrder,
    getSnapshot,
    updateSnapshot,
    saveReceipt,
    getReceipt,
    listReceiptsMeta,
    deleteReceipt,
    createUser,
    verifyUserLogin,
    rotateUserPassword,
    createPasswordResetToken,
    consumePasswordResetToken,
    saveFeedback,
    listFeedback,
    createSession,
    getSessionByToken,
    deleteSessionByToken,
    createInvite,
    getInviteByCode,
    listInvites,
    deleteHouseholdCascade,
  };
}
