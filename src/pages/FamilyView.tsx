import React, { useEffect, useState } from 'react';
import {
  Activity,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  Link2,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import type { FamilyMember, MemberRole } from '../types/finance';
import { computeMemberSummaries } from '../utils/calculations';
import { formatMoney } from '../utils/currency';
import { canCreateMember } from '../utils/entitlements';
import {
  createServerInvite,
  listServerInvites,
  type ServerInvite,
} from '../storage/syncClient';
import { computeMemberIouBalances } from '../utils/wealth';
import { useI18n } from '../i18n/useI18n';

export const FamilyView: React.FC = () => {
  const {
    state,
    selectedMonth,
    authSession,
    roleCapabilities,
    getAuthSyncConfig,
    setActiveView,
    pushToast,
    syncStatus,
    syncRevision,
    upsertMember,
    deleteMember,
    settleMemberSplit,
    settleMemberPairIous,
  } = useFinance();
  const { baseCurrency, privacyMode } = state.settings;
  const { t, formatMonth, memName, roleBadge, roleLabel, entityText } = useI18n();

  const [name, setName] = useState('');
  const [role, setRole] = useState<MemberRole>('partner');
  const [avatar, setAvatar] = useState('🧑🏽');
  const [allowance, setAllowance] = useState('500');
  const [incomeTarget, setIncomeTarget] = useState('');
  const [recordIouTransfer, setRecordIouTransfer] = useState(true);

  const [inviteRole, setInviteRole] = useState<'partner' | 'dependent' | 'advisor'>('partner');
  const [inviteEmail, setInviteEmail] = useState('');
  const [latestInviteUrl, setLatestInviteUrl] = useState('');
  const [invitesList, setInvitesList] = useState<ServerInvite[]>([]);

  const memberLimit = canCreateMember(state);

  useEffect(() => {
    if (!authSession || authSession.isDemo || authSession.role !== 'admin') return;
    let active = true;
    void listServerInvites(getAuthSyncConfig()).then((list) => {
      if (active && list) setInvitesList(list);
    });
    return () => {
      active = false;
    };
  }, [authSession, getAuthSyncConfig]);

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createServerInvite(getAuthSyncConfig(), {
      role: inviteRole,
      email: inviteEmail.trim() || undefined,
    });
    if (!res?.inviteUrl) {
      pushToast(t('fam.inviteLocalNote'));
      return;
    }
    setLatestInviteUrl(res.inviteUrl);
    setInviteEmail('');
    const list = await listServerInvites(getAuthSyncConfig());
    if (list) setInvitesList(list);
  };

  const handleCopyInvite = async () => {
    if (!latestInviteUrl) return;
    try {
      await navigator.clipboard?.writeText(latestInviteUrl);
    } catch {
      // clipboard unavailable in headless environments
    }
    pushToast(t('fam.inviteCopied'));
  };

  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberDraft, setMemberDraft] = useState<{
    name: string;
    role: MemberRole;
    avatar: string;
    monthlyAllowance: string;
    monthlyIncomeTarget: string;
  } | null>(null);

  const startEditMember = (m: FamilyMember) => {
    setEditingMemberId(m.id);
    setMemberDraft({
      name: m.name,
      role: m.role,
      avatar: m.avatar,
      monthlyAllowance: String(m.monthlyAllowance),
      monthlyIncomeTarget: m.monthlyIncomeTarget ? String(m.monthlyIncomeTarget) : '',
    });
  };

  const handleSaveMemberEdit = (member: FamilyMember) => {
    if (!memberDraft || !memberDraft.name.trim()) return;
    const targetVal = parseFloat(memberDraft.monthlyIncomeTarget);
    upsertMember({
      ...member,
      name: memberDraft.name.trim(),
      role: memberDraft.role,
      avatar: memberDraft.avatar || '👤',
      monthlyAllowance: parseFloat(memberDraft.monthlyAllowance) || 0,
      monthlyIncomeTarget: targetVal > 0 ? targetVal : undefined,
    });
    setEditingMemberId(null);
    setMemberDraft(null);
  };

  const summaries = computeMemberSummaries(state.members, state.transactions, selectedMonth);
  const netIous = computeMemberIouBalances(state.transactions);

  const sharedSplitTxs = state.transactions.filter(
    (tx) => tx.memberSplits && tx.memberSplits.length > 0
  );

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!memberLimit.allowed) {
      pushToast(t('ent.memberLimitReached', { max: memberLimit.limit ?? 4 }));
      return;
    }
    const targetVal = parseFloat(incomeTarget);
    upsertMember({
      id: `m-${Date.now()}`,
      name: name.trim(),
      role,
      avatar: avatar || '👤',
      color: '#3b82f6',
      monthlyAllowance: parseFloat(allowance) || 0,
      monthlyIncomeTarget: targetVal > 0 ? targetVal : undefined,
    });
    setName('');
    setIncomeTarget('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {t('fam.title')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('fam.subtitle', { month: formatMonth(selectedMonth) })}
        </p>
      </div>

      {/* Member Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {summaries.map(
          ({
            member,
            income,
            expense,
            net,
            allowanceUsedPct,
            splitOwedToOthers,
            splitOwedByOthers,
          }) => {
            const isEditing = editingMemberId === member.id && memberDraft;
            const incomeTargetPct =
              member.monthlyIncomeTarget && member.monthlyIncomeTarget > 0
                ? Math.min(100, Math.round((income / member.monthlyIncomeTarget) * 100))
                : null;

            return (
            <div
              key={member.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
            >
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      value={memberDraft.name}
                      onChange={(e) =>
                        setMemberDraft((d) => (d ? { ...d, name: e.target.value } : d))
                      }
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                    <div className="flex gap-2">
                      <select
                        value={memberDraft.role}
                        onChange={(e) =>
                          setMemberDraft((d) =>
                            d ? { ...d, role: e.target.value as MemberRole } : d
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                      >
                        <option value="partner">{roleLabel('partner')}</option>
                        <option value="dependent">{roleLabel('dependent')}</option>
                        <option value="admin">{roleLabel('admin')}</option>
                        <option value="shared">{roleLabel('shared')}</option>
                      </select>
                      <input
                        type="text"
                        value={memberDraft.avatar}
                        onChange={(e) =>
                          setMemberDraft((d) => (d ? { ...d, avatar: e.target.value } : d))
                        }
                        className="w-14 rounded-lg border border-slate-300 px-2 py-1.5 text-center text-sm dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={memberDraft.monthlyAllowance}
                      onChange={(e) =>
                        setMemberDraft((d) =>
                          d ? { ...d, monthlyAllowance: e.target.value } : d
                        )
                      }
                      placeholder={t('fam.allowancePlaceholder')}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                    <input
                      type="number"
                      min="0"
                      value={memberDraft.monthlyIncomeTarget}
                      onChange={(e) =>
                        setMemberDraft((d) =>
                          d ? { ...d, monthlyIncomeTarget: e.target.value } : d
                        )
                      }
                      placeholder={t('fam.incomeTargetPlaceholder')}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMemberId(null);
                        setMemberDraft(null);
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                    >
                      {t('layout.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveMemberEdit(member)}
                      className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      {t('common.save')}
                    </button>
                  </div>
                </div>
              ) : (
                <>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl dark:bg-slate-800">
                    {member.avatar}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      {memName(member)}
                    </h2>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {roleBadge(member.role)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEditMember(member)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
                    aria-label={t('fam.editAria', { name: member.name })}
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  {state.members.length > 1 && (
                    <button
                      type="button"
                      onClick={() => deleteMember(member.id)}
                      className="rounded p-1 text-slate-400 hover:text-rose-500"
                      aria-label={t('fam.removeAria', { name: member.name })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/60">
                <div>
                  <div className="text-[11px] text-slate-500">{t('fam.income')}</div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    +{formatMoney(income, baseCurrency, privacyMode)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">{t('fam.spent')}</div>
                  <div className="text-sm font-bold text-rose-600 dark:text-rose-400">
                    -{formatMoney(expense, baseCurrency, privacyMode)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">{t('fam.net')}</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {formatMoney(net, baseCurrency, privacyMode)}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    {t('fam.allowanceLabel')}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      value={member.monthlyAllowance}
                      onChange={(e) =>
                        upsertMember({
                          ...member,
                          monthlyAllowance: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-20 rounded border border-slate-200 px-1.5 py-0.5 text-right text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                      aria-label={t('fam.allowanceAria', { name: member.name })}
                    />
                    <span className="text-[11px] font-semibold text-slate-500">
                      ({allowanceUsedPct}%)
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full ${
                      allowanceUsedPct > 100 ? 'bg-rose-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.min(100, allowanceUsedPct)}%` }}
                  />
                </div>
                {incomeTargetPct !== null && member.monthlyIncomeTarget && (
                  <p className="mt-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    {t('fam.incomeTargetLine', {
                      target: formatMoney(member.monthlyIncomeTarget, baseCurrency, privacyMode),
                      pct: incomeTargetPct,
                    })}
                  </p>
                )}
              </div>

              {(splitOwedByOthers > 0 || splitOwedToOthers > 0) && (
                <div className="mt-3 flex items-center justify-between rounded-lg bg-violet-50 px-3 py-1.5 text-xs text-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
                  <span>{t('fam.splitIouBalance')}</span>
                  <span className="font-bold">
                    {t('fam.owedOwes', {
                      owed: formatMoney(splitOwedByOthers, baseCurrency, privacyMode),
                      owes: formatMoney(splitOwedToOthers, baseCurrency, privacyMode),
                    })}
                  </span>
                </div>
              )}
                </>
              )}
            </div>
            );
          }
        )}
      </div>

      {/* Shared Bill Splits Settlement Center */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-violet-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t('fam.splitsHeading')}
            </h2>
          </div>
          {netIous.length > 0 && (
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={recordIouTransfer}
                onChange={(e) => setRecordIouTransfer(e.target.checked)}
              />
              {t('fam.logEntryToggle')}
            </label>
          )}
        </div>

        {/* Simplified Net IOUs */}
        {netIous.length > 0 && (
          <div className="mb-4 space-y-2 rounded-xl border border-violet-200 bg-violet-50/50 p-3.5 dark:border-violet-900/60 dark:bg-violet-950/20">
            <div className="text-xs font-bold uppercase tracking-wider text-violet-900 dark:text-violet-200">
              {t('fam.iouPlanHeading')}
            </div>
            {netIous.map((iou) => {
              const fromMem = state.members.find((m) => m.id === iou.fromMemberId);
              const toMem = state.members.find((m) => m.id === iou.toMemberId);
              return (
                <div
                  key={`${iou.fromMemberId}-${iou.toMemberId}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs shadow-2xs dark:bg-slate-900"
                >
                  <div>
                    <span className="font-bold">
                      {fromMem?.avatar} {memName(fromMem)}
                    </span>{' '}
                    {t('fam.owesWord')}{' '}
                    <span className="font-bold">
                      {toMem?.avatar} {memName(toMem)}
                    </span>{' '}
                    <span className="font-extrabold text-violet-700 dark:text-violet-300">
                      {formatMoney(iou.netAmount, baseCurrency, privacyMode)}
                    </span>{' '}
                    <span className="text-[11px] text-slate-500">
                      ({iou.splitCount}{' '}
                      {iou.splitCount === 1 ? t('fam.splitSingular') : t('fam.splitPlural')})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      settleMemberPairIous(iou.fromMemberId, iou.toMemberId, iou.netAmount, {
                        recordEntry: recordIouTransfer,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1 text-xs font-semibold text-white hover:bg-violet-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t('fam.settleAll')}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {sharedSplitTxs.length === 0 ? (
          <p className="text-xs text-slate-500">{t('fam.noSplits')}</p>
        ) : (
          <div className="space-y-3">
            {sharedSplitTxs.map((tx) => {
              const payer = state.members.find((m) => m.id === tx.memberId);
              return (
                <div
                  key={tx.id}
                  className="rounded-xl border border-slate-100 p-3.5 dark:border-slate-800"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {entityText(tx.merchant)}
                      </span>{' '}
                      <span className="text-xs text-slate-500">
                        ({tx.date} •{' '}
                        {t('fam.paidBy', {
                          avatar: payer?.avatar ?? '',
                          name: memName(payer),
                        })}
                        )
                      </span>
                    </div>
                    <span className="text-sm font-extrabold">
                      {formatMoney(tx.amount, tx.currency, privacyMode)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tx.memberSplits?.map((sp) => {
                      const mem = state.members.find((m) => m.id === sp.memberId);
                      return (
                        <button
                          key={sp.memberId}
                          type="button"
                          onClick={() => settleMemberSplit(tx.id, sp.memberId)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                            sp.settled
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
                          }`}
                        >
                          {sp.settled && <Check className="h-3 w-3" />}
                          <span>
                            {mem?.avatar} {memName(mem)}:{' '}
                            {formatMoney(sp.amount, tx.currency, privacyMode)}
                          </span>
                          <span className="text-[10px] opacity-80">
                            ({sp.settled ? t('fam.settled') : t('fam.markSettled')})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Family Member */}
      {!memberLimit.allowed && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <span>{t('ent.memberLimitReached', { max: memberLimit.limit ?? 4 })}</span>
          <button
            type="button"
            onClick={() => setActiveView('pricing')}
            className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700"
          >
            {t('ent.upgradeBtn')}
          </button>
        </div>
      )}

      <form
        onSubmit={handleAddMember}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-6"
      >
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('fam.memberNamePlaceholder')}
          className="rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as MemberRole)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="partner">{roleLabel('partner')}</option>
          <option value="dependent">{roleLabel('dependent')}</option>
          <option value="admin">{roleLabel('admin')}</option>
          <option value="shared">{roleLabel('shared')}</option>
        </select>
        <input
          type="text"
          value={avatar}
          onChange={(e) => setAvatar(e.target.value)}
          placeholder={t('fam.avatarPlaceholder')}
          className="rounded-xl border border-slate-300 px-3 py-2 text-center text-sm dark:border-slate-700 dark:bg-slate-800"
        />
        <input
          type="number"
          min="0"
          value={allowance}
          onChange={(e) => setAllowance(e.target.value)}
          placeholder={t('fam.allowancePlaceholder')}
          className="rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
        />
        <input
          type="number"
          min="0"
          value={incomeTarget}
          onChange={(e) => setIncomeTarget(e.target.value)}
          placeholder={t('fam.incomeTargetPlaceholder')}
          className="rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> {t('fam.addMemberBtn')}
        </button>
      </form>

      {/* Household Invite Links (Admin Only for Authenticated Cloud Sync) */}
      {roleCapabilities.canDeleteHouseholdData && authSession && !authSession.isDemo && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t('fam.inviteHeading')}
            </h2>
          </div>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{t('fam.inviteDesc')}</p>

          <form
            onSubmit={(e) => void handleGenerateInvite(e)}
            className="grid grid-cols-1 gap-2 sm:grid-cols-3"
          >
            <select
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(e.target.value as 'partner' | 'dependent' | 'advisor')
              }
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="partner">{roleLabel('partner')}</option>
              <option value="dependent">{roleLabel('dependent')}</option>
              <option value="advisor">{t('auth.roleAdvisorBadge')}</option>
            </select>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder={t('fam.inviteEmailPlaceholder')}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <Link2 className="h-3.5 w-3.5" />
              {t('fam.createInviteBtn')}
            </button>
          </form>

          {latestInviteUrl && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs dark:border-emerald-900 dark:bg-emerald-950/30">
              <code className="truncate font-mono text-[11px] text-emerald-900 dark:text-emerald-200">
                {latestInviteUrl}
              </code>
              <button
                type="button"
                onClick={() => void handleCopyInvite()}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
              >
                <Copy className="h-3 w-3" />
                Copy
              </button>
            </div>
          )}

          {invitesList.length > 0 && (
            <div className="mt-3 divide-y divide-slate-100 text-xs dark:divide-slate-800">
              {invitesList.slice(0, 5).map((inv) => (
                <div key={inv.code} className="flex items-center justify-between py-1.5">
                  <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                    {inv.code} • {inv.role}
                    {inv.invitedEmail ? ` (${inv.invitedEmail})` : ''}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      inv.usedAt
                        ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                    }`}
                  >
                    {inv.usedAt ? t('fam.inviteUsedBadge') : t('fam.inviteActiveBadge')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Household Activity Audit Feed */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t('fam.auditHeading')}
            </h2>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {syncStatus === 'synced'
              ? t('fam.sqliteSynced', { rev: syncRevision })
              : t('fam.localAuditLog')}
          </span>
        </div>

        {(state.auditLog ?? []).length === 0 ? (
          <p className="text-xs text-slate-500">{t('fam.emptyAudit')}</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {(state.auditLog ?? []).slice(0, 12).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 py-2 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="text-base">{entry.memberAvatar}</span>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {entityText(entry.memberName)}
                    </span>{' '}
                    <span className="text-slate-600 dark:text-slate-300">{entry.summary}</span>
                  </div>
                </div>
                <span className="shrink-0 text-[11px] text-slate-400">
                  {new Date(entry.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
