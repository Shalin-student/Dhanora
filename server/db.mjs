import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function tableHasColumn(db, tableName, columnName) {
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return cols.some((c) => c.name === columnName);
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function createSyncDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec('PRAGMA busy_timeout = 5000;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS households (
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
    );

    CREATE TABLE IF NOT EXISTS household_state (
      id TEXT PRIMARY KEY,
      revision INTEGER NOT NULL DEFAULT 0,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by_member_id TEXT,
      updated_by_name TEXT
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL DEFAULT 'default',
      tx_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      data_url TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL DEFAULT 'default',
      member_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      member_avatar TEXT NOT NULL,
      action TEXT NOT NULL,
      summary TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
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
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      household_id TEXT NOT NULL,
      role TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invites (
      code TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      role TEXT NOT NULL,
      invited_email TEXT,
      created_by_user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_by_user_id TEXT,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS billing_invoices (
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
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feedback_messages (
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
    );
  `);

  // Safe non-destructive schema upgrades for pre-existing local SQLite databases
  if (!tableHasColumn(db, 'receipts', 'household_id')) {
    db.exec(`ALTER TABLE receipts ADD COLUMN household_id TEXT NOT NULL DEFAULT 'default';`);
  }
  if (!tableHasColumn(db, 'activity_log', 'household_id')) {
    db.exec(`ALTER TABLE activity_log ADD COLUMN household_id TEXT NOT NULL DEFAULT 'default';`);
  }
  if (!tableHasColumn(db, 'users', 'household_id')) {
    db.exec(`ALTER TABLE users ADD COLUMN household_id TEXT NOT NULL DEFAULT 'default';`);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_receipts_tx ON receipts (tx_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_hh ON receipts (household_id, tx_id);
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log (household_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
    CREATE INDEX IF NOT EXISTS idx_users_hh ON users (household_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
    CREATE INDEX IF NOT EXISTS idx_invites_hh ON invites (household_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_hh ON billing_invoices (household_id, created_at DESC);
  `);

  const nowIso = () => new Date().toISOString();

  const ensureHouseholdStmt = db.prepare(`
    INSERT INTO households (id, name, plan_tier, plan_status, created_at)
    VALUES (?, ?, 'free', 'active', ?)
    ON CONFLICT(id) DO NOTHING
  `);
  ensureHouseholdStmt.run('default', 'Shared Household', nowIso());

  const getHouseholdStmt = db.prepare(`
    SELECT id, name, plan_tier AS planTier, plan_status AS planStatus,
           billing_cycle AS billingCycle, trial_ends_at AS trialEndsAt,
           plan_expires_at AS planExpiresAt, billing_provider AS billingProvider,
           created_at AS createdAt
    FROM households WHERE id = ?
  `);

  const insertHouseholdStmt = db.prepare(`
    INSERT INTO households (id, name, plan_tier, plan_status, billing_cycle, trial_ends_at, created_at)
    VALUES (?, ?, ?, ?, 'yearly', ?, ?)
  `);

  const updateHouseholdBillingStmt = db.prepare(`
    UPDATE households
    SET plan_tier = ?, plan_status = ?, billing_cycle = ?,
        trial_ends_at = ?, plan_expires_at = ?, billing_provider = ?
    WHERE id = ?
  `);

  const getStateStmt = db.prepare(
    'SELECT revision, state_json, updated_at, updated_by_member_id, updated_by_name FROM household_state WHERE id = ?'
  );
  const upsertStateStmt = db.prepare(`
    INSERT INTO household_state (id, revision, state_json, updated_at, updated_by_member_id, updated_by_name)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      revision = excluded.revision,
      state_json = excluded.state_json,
      updated_at = excluded.updated_at,
      updated_by_member_id = excluded.updated_by_member_id,
      updated_by_name = excluded.updated_by_name
  `);

  const insertActivityStmt = db.prepare(`
    INSERT INTO activity_log (id, household_id, member_id, member_name, member_avatar, action, summary, entity_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const listActivityStmt = db.prepare(`
    SELECT id, member_id AS memberId, member_name AS memberName, member_avatar AS memberAvatar,
           action, summary, entity_type AS entityType, created_at AS createdAt
    FROM activity_log
    WHERE household_id = ?
    ORDER BY created_at DESC, rowid DESC
    LIMIT 100
  `);
  const trimActivityStmt = db.prepare(`
    DELETE FROM activity_log
    WHERE household_id = ? AND id NOT IN (
      SELECT id FROM activity_log WHERE household_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 250
    )
  `);

  const upsertReceiptStmt = db.prepare(`
    INSERT INTO receipts (id, household_id, tx_id, file_name, mime_type, size_bytes, data_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      tx_id = excluded.tx_id,
      file_name = excluded.file_name,
      mime_type = excluded.mime_type,
      size_bytes = excluded.size_bytes,
      data_url = excluded.data_url,
      created_at = excluded.created_at
    WHERE receipts.household_id = excluded.household_id
  `);
  const getReceiptAnyStmt = db.prepare(`
    SELECT id, household_id AS householdId, tx_id AS txId, file_name AS fileName,
           mime_type AS mimeType, size_bytes AS sizeBytes, data_url AS dataUrl, created_at AS createdAt
    FROM receipts WHERE id = ?
  `);
  const getReceiptScopedStmt = db.prepare(`
    SELECT id, household_id AS householdId, tx_id AS txId, file_name AS fileName,
           mime_type AS mimeType, size_bytes AS sizeBytes, data_url AS dataUrl, created_at AS createdAt
    FROM receipts WHERE id = ? AND household_id = ?
  `);
  const listReceiptsMetaStmt = db.prepare(`
    SELECT id, tx_id AS txId, file_name AS fileName, mime_type AS mimeType,
           size_bytes AS sizeBytes, created_at AS createdAt
    FROM receipts WHERE household_id = ? ORDER BY created_at DESC
  `);
  const deleteReceiptScopedStmt = db.prepare(
    'DELETE FROM receipts WHERE id = ? AND household_id = ?'
  );

  const getUserByEmailStmt = db.prepare(`
    SELECT id, household_id AS householdId, email, name, role, member_id AS memberId, avatar,
           password_hash AS passwordHash, password_salt AS passwordSalt
    FROM users WHERE email = ?
  `);
  const getUserByIdStmt = db.prepare(`
    SELECT id, household_id AS householdId, email, name, role, member_id AS memberId, avatar,
           password_hash AS passwordHash, password_salt AS passwordSalt
    FROM users WHERE id = ?
  `);
  const insertUserStmt = db.prepare(`
    INSERT INTO users (id, household_id, email, name, role, member_id, avatar, password_hash, password_salt, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateUserPwStmt = db.prepare(`
    UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?
  `);

  const insertSessionStmt = db.prepare(`
    INSERT INTO sessions (token_hash, user_id, household_id, role, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const getSessionJoinStmt = db.prepare(`
    SELECT s.user_id AS userId, s.household_id AS householdId, s.role, s.expires_at AS expiresAt,
           u.name, u.email, u.member_id AS memberId, u.avatar,
           h.name AS householdName, h.plan_tier AS planTier, h.plan_status AS planStatus,
           h.billing_cycle AS billingCycle, h.trial_ends_at AS trialEndsAt, h.plan_expires_at AS planExpiresAt
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    JOIN households h ON h.id = s.household_id
    WHERE s.token_hash = ?
  `);
  const deleteSessionStmt = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
  const deleteUserSessionsStmt = db.prepare('DELETE FROM sessions WHERE user_id = ?');

  const insertInviteStmt = db.prepare(`
    INSERT INTO invites (code, household_id, role, invited_email, created_by_user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const getInviteStmt = db.prepare(`
    SELECT i.code, i.household_id AS householdId, i.role, i.invited_email AS invitedEmail,
           i.expires_at AS expiresAt, i.used_at AS usedAt, h.name AS householdName
    FROM invites i
    JOIN households h ON h.id = i.household_id
    WHERE i.code = ?
  `);
  const listInvitesStmt = db.prepare(`
    SELECT code, role, invited_email AS invitedEmail, expires_at AS expiresAt,
           used_at AS usedAt, created_at AS createdAt
    FROM invites WHERE household_id = ? ORDER BY created_at DESC LIMIT 25
  `);
  const markInviteUsedStmt = db.prepare(`
    UPDATE invites SET used_by_user_id = ?, used_at = ? WHERE code = ? AND used_at IS NULL
  `);

  const insertInvoiceStmt = db.prepare(`
    INSERT INTO billing_invoices (
      id, household_id, provider, provider_payment_id, provider_order_id,
      plan_tier, billing_cycle, currency, amount_minor, gst_number, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(provider_payment_id) DO NOTHING
  `);
  const listInvoicesStmt = db.prepare(`
    SELECT id, household_id AS householdId, provider, provider_payment_id AS providerPaymentId,
           provider_order_id AS providerOrderId, plan_tier AS planTier, billing_cycle AS billingCycle,
           currency, amount_minor AS amountMinor, gst_number AS gstNumber, status, created_at AS createdAt
    FROM billing_invoices WHERE household_id = ? ORDER BY created_at DESC LIMIT 50
  `);

  function hashUserPassword(password, salt) {
    return crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex');
  }

  function createSession({ userId, householdId, role, ttlDays = 14 }) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashSessionToken(rawToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlDays * 86400000).toISOString();
    insertSessionStmt.run(tokenHash, userId, householdId, role, expiresAt, now.toISOString());
    return { token: rawToken, expiresAt };
  }

  function getSessionByToken(rawToken) {
    if (!rawToken) return null;
    const row = getSessionJoinStmt.get(hashSessionToken(rawToken));
    if (!row) return null;
    if (Date.parse(row.expiresAt) < Date.now()) {
      deleteSessionStmt.run(hashSessionToken(rawToken));
      return null;
    }
    return row;
  }

  function deleteSessionByToken(rawToken) {
    if (!rawToken) return;
    deleteSessionStmt.run(hashSessionToken(rawToken));
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

  function createUser({
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
    if (getUserByEmailStmt.get(cleanEmail)) {
      return { exists: true };
    }

    const now = nowIso();
    let targetHouseholdId = `hh-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    let effectiveRole = ['admin', 'partner', 'dependent', 'advisor'].includes(role) ? role : 'admin';
    let effectivePlan = ['free', 'plus', 'advisor'].includes(planTier) ? planTier : 'free';

    db.exec('BEGIN IMMEDIATE');
    try {
      let usedInvite = null;
      if (inviteCode && String(inviteCode).trim()) {
        const inv = getInviteStmt.get(String(inviteCode).trim());
        if (!inv || inv.usedAt || Date.parse(inv.expiresAt) < Date.now()) {
          db.exec('ROLLBACK');
          return { invalidInvite: true };
        }
        if (inv.invitedEmail && inv.invitedEmail.toLowerCase() !== cleanEmail) {
          db.exec('ROLLBACK');
          return { invalidInvite: true };
        }
        targetHouseholdId = inv.householdId;
        effectiveRole = inv.role;
        usedInvite = inv.code;
      } else {
        const cleanHhName = String(householdName || '').trim() || `${String(name).trim()}'s Household`;
        const trialEnds =
          effectivePlan === 'plus'
            ? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
            : null;
        const status = effectivePlan === 'plus' ? 'trialing' : 'active';
        insertHouseholdStmt.run(targetHouseholdId, cleanHhName, effectivePlan, status, trialEnds, now);
      }

      const id = `usr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = hashUserPassword(password, salt);
      insertUserStmt.run(
        id,
        targetHouseholdId,
        cleanEmail,
        String(name).trim(),
        effectiveRole,
        memberId,
        avatar,
        hash,
        salt,
        now
      );

      if (usedInvite) {
        markInviteUsedStmt.run(id, now, usedInvite);
      }

      db.exec('COMMIT');

      const hh = getHouseholdStmt.get(targetHouseholdId);
      const { token } = createSession({
        userId: id,
        householdId: targetHouseholdId,
        role: effectiveRole,
      });

      return {
        exists: false,
        session: buildSessionPayload(
          {
            userId: id,
            householdId: targetHouseholdId,
            householdName: hh?.name ?? householdName ?? 'Household',
            name: String(name).trim(),
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
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore
      }
      throw err;
    }
  }

  function verifyUserLogin(email, password) {
    const row = getUserByEmailStmt.get(String(email).trim().toLowerCase());
    if (!row) return null;
    const candidate = hashUserPassword(password, row.passwordSalt);
    if (candidate !== row.passwordHash) return null;

    const hh = getHouseholdStmt.get(row.householdId);
    const { token } = createSession({
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

  function rotateUserPassword(userId, currentPassword, nextPassword) {
    const row = getUserByIdStmt.get(userId);
    if (!row) return { ok: false, error: 'NOT_FOUND' };
    if (hashUserPassword(currentPassword, row.passwordSalt) !== row.passwordHash) {
      return { ok: false, error: 'INVALID_CURRENT_PASSWORD' };
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashUserPassword(nextPassword, salt);
    updateUserPwStmt.run(hash, salt, userId);
    deleteUserSessionsStmt.run(userId);
    return { ok: true };
  }

  function createPasswordResetToken(email, ttlMinutes = 30) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) return null;
    const user = getUserByEmailStmt.get(cleanEmail);
    if (!user) return null;
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashSessionToken(rawToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60000).toISOString();
    db.prepare(
      `INSERT INTO password_resets (token_hash, user_id, email, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(tokenHash, user.id, user.email, expiresAt, now.toISOString());
    return { token: rawToken, email: user.email, name: user.name, expiresAt };
  }

  function consumePasswordResetToken({ token, newPassword }) {
    const cleanToken = String(token || '').trim();
    if (!cleanToken) return { ok: false, error: 'INVALID_OR_EXPIRED_RESET_TOKEN' };
    const tokenHash = hashSessionToken(cleanToken);
    const row = db
      .prepare(
        `SELECT token_hash AS tokenHash, user_id AS userId, expires_at AS expiresAt, used_at AS usedAt
         FROM password_resets WHERE token_hash = ?`
      )
      .get(tokenHash);
    if (!row || row.usedAt || Date.parse(row.expiresAt) < Date.now()) {
      return { ok: false, error: 'INVALID_OR_EXPIRED_RESET_TOKEN' };
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashUserPassword(newPassword, salt);
    db.prepare('UPDATE password_resets SET used_at = ? WHERE token_hash = ?').run(nowIso(), tokenHash);
    updateUserPwStmt.run(hash, salt, row.userId);
    deleteUserSessionsStmt.run(row.userId);
    return { ok: true };
  }

  function saveFeedback({ householdId, userId, userEmail, userName, category, message, pageView }) {
    const id = `fb-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = nowIso();
    db.prepare(
      `INSERT INTO feedback_messages (id, household_id, user_id, user_email, user_name, category, message, page_view, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`
    ).run(
      id,
      householdId ?? null,
      userId ?? null,
      userEmail ?? null,
      userName ?? null,
      String(category || 'general').slice(0, 40),
      String(message || '').trim().slice(0, 4000),
      pageView ?? null,
      now
    );
    return { id, createdAt: now };
  }

  function listFeedback(householdId) {
    if (!householdId) return [];
    return db
      .prepare(
        `SELECT id, category, message, page_view AS pageView, status, created_at AS createdAt
         FROM feedback_messages WHERE household_id = ? ORDER BY created_at DESC LIMIT 20`
      )
      .all(householdId);
  }

  function getHousehold(householdId) {
    return getHouseholdStmt.get(householdId) ?? null;
  }

  function updateHouseholdBilling(householdId, patch) {
    const cur = getHouseholdStmt.get(householdId);
    if (!cur) return null;
    const nextTier = patch.planTier ?? cur.planTier;
    const nextStatus = patch.planStatus ?? cur.planStatus;
    const nextCycle = patch.billingCycle ?? cur.billingCycle ?? 'yearly';
    const nextTrialEnds =
      patch.trialEndsAt !== undefined ? patch.trialEndsAt : cur.trialEndsAt;
    const nextPlanExpires =
      patch.planExpiresAt !== undefined ? patch.planExpiresAt : cur.planExpiresAt;
    const nextProvider =
      patch.billingProvider !== undefined ? patch.billingProvider : cur.billingProvider;

    updateHouseholdBillingStmt.run(
      nextTier,
      nextStatus,
      nextCycle,
      nextTrialEnds,
      nextPlanExpires,
      nextProvider,
      householdId
    );
    return getHouseholdStmt.get(householdId);
  }

  function recordInvoice(invoice) {
    const id = invoice.id ?? `inv-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    insertInvoiceStmt.run(
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
    );
    return id;
  }

  function listInvoices(householdId) {
    return listInvoicesStmt.all(householdId);
  }

  function createInvite({ householdId, role, invitedEmail, createdByUserId, ttlHours = 72 }) {
    const validRole = ['partner', 'dependent', 'advisor'].includes(role) ? role : 'partner';
    const code = crypto.randomBytes(6).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlHours * 3600000).toISOString();
    insertInviteStmt.run(
      code,
      householdId,
      validRole,
      invitedEmail ? String(invitedEmail).trim().toLowerCase() : null,
      createdByUserId,
      expiresAt,
      now.toISOString()
    );
    return {
      code,
      householdId,
      role: validRole,
      invitedEmail: invitedEmail || null,
      expiresAt,
    };
  }

  function getInviteByCode(code) {
    if (!code) return null;
    const inv = getInviteStmt.get(String(code).trim());
    if (!inv) return null;
    const expired = Date.parse(inv.expiresAt) < Date.now();
    return {
      ...inv,
      valid: !inv.usedAt && !expired,
      expired,
    };
  }

  function listInvites(householdId) {
    return listInvitesStmt.all(householdId);
  }

  function deleteHouseholdCascade(householdId) {
    if (!householdId || householdId === 'default') return false;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('DELETE FROM sessions WHERE household_id = ?').run(householdId);
      db.prepare('DELETE FROM invites WHERE household_id = ?').run(householdId);
      db.prepare('DELETE FROM receipts WHERE household_id = ?').run(householdId);
      db.prepare('DELETE FROM activity_log WHERE household_id = ?').run(householdId);
      db.prepare('DELETE FROM billing_invoices WHERE household_id = ?').run(householdId);
      db.prepare('DELETE FROM household_state WHERE id = ?').run(householdId);
      db.prepare('DELETE FROM users WHERE household_id = ?').run(householdId);
      db.prepare('DELETE FROM households WHERE id = ?').run(householdId);
      db.exec('COMMIT');
      return true;
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore
      }
      throw err;
    }
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

  function getSnapshot(householdId = 'default') {
    const hhId = householdId || 'default';
    const row = getStateStmt.get(hhId);
    const activity = listActivityStmt.all(hhId);
    const hh = getHouseholdStmt.get(hhId);
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

  function updateSnapshot({
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
    ensureHouseholdStmt.run(hhId, cleanState?.settings?.householdName || 'Household', now);
    const hh = getHouseholdStmt.get(hhId);
    if (hh && cleanState?.settings) {
      cleanState.settings.planTier = hh.planTier;
      cleanState.settings.trialEndsAt = hh.trialEndsAt ?? undefined;
    }

    db.exec('BEGIN IMMEDIATE');
    try {
      const current = getStateStmt.get(hhId);
      const currentRevision = current ? current.revision : 0;

      if (!force && currentRevision > 0 && baseRevision !== currentRevision) {
        db.exec('ROLLBACK');
        return {
          conflict: true,
          snapshot: {
            revision: currentRevision,
            state: current ? JSON.parse(current.state_json) : null,
            updatedAt: current ? current.updated_at : null,
            activity: listActivityStmt.all(hhId),
          },
        };
      }

      const nextRevision = currentRevision + 1;
      upsertStateStmt.run(
        hhId,
        nextRevision,
        JSON.stringify(cleanState),
        now,
        actor?.memberId ?? null,
        actor?.memberName ?? null
      );

      if (auditEntry && auditEntry.summary) {
        const entryId = `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        insertActivityStmt.run(
          entryId,
          hhId,
          actor?.memberId ?? 'm-shared',
          actor?.memberName ?? 'Household',
          actor?.memberAvatar ?? '🏡',
          auditEntry.action ?? 'update',
          auditEntry.summary,
          auditEntry.entityType ?? 'sync',
          now
        );
        trimActivityStmt.run(hhId, hhId);
      }

      db.exec('COMMIT');
      return {
        conflict: false,
        revision: nextRevision,
        updatedAt: now,
        activity: listActivityStmt.all(hhId),
      };
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // already rolled back
      }
      throw err;
    }
  }

  function saveReceipt(receipt, householdId = 'default') {
    const hhId = householdId || 'default';
    const existing = getReceiptAnyStmt.get(receipt.id);
    if (existing && existing.householdId !== hhId) {
      throw Object.assign(new Error('FORBIDDEN_RECEIPT_CROSS_TENANT'), { statusCode: 403 });
    }
    upsertReceiptStmt.run(
      receipt.id,
      hhId,
      receipt.txId,
      receipt.fileName,
      receipt.mimeType,
      Number(receipt.sizeBytes || 0),
      receipt.dataUrl,
      receipt.createdAt || nowIso()
    );
  }

  function getReceipt(id, householdId = 'default') {
    if (!householdId) return getReceiptAnyStmt.get(id) ?? null;
    return getReceiptScopedStmt.get(id, householdId) ?? null;
  }

  function listReceiptsMeta(householdId = 'default') {
    return listReceiptsMetaStmt.all(householdId || 'default');
  }

  function deleteReceipt(id, householdId = 'default') {
    deleteReceiptScopedStmt.run(id, householdId || 'default');
  }

  function close() {
    db.close();
  }

  return {
    getHousehold,
    updateHouseholdBilling,
    recordInvoice,
    listInvoices,
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
    close,
  };
}
