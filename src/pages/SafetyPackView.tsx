import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  HeartPulse,
  Plus,
  Printer,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import type { InsuranceType } from '../types/finance';
import { computeCategorySpending } from '../utils/calculations';
import { formatMoney } from '../utils/currency';
import { computeInsuranceAdequacy, containsSensitiveCredentialHint } from '../utils/planners';
import { useI18n } from '../i18n/useI18n';

export const SafetyPackView: React.FC = () => {
  const {
    state,
    selectedMonth,
    upsertAccount,
    upsertPolicy,
    deletePolicy,
    updateEmergencyInfo,
  } = useFinance();
  const { baseCurrency, privacyMode } = state.settings;
  const { t, accName, memName, entityText, policyTypeLabel } = useI18n();

  const [polName, setPolName] = useState('');
  const [polInsurer, setPolInsurer] = useState('');
  const [polType, setPolType] = useState<InsuranceType>('term');
  const [polCover, setPolCover] = useState('10000000');
  const [polPremium, setPolPremium] = useState('18000');
  const [polNominee, setPolNominee] = useState('');
  const [polRenewal, setPolRenewal] = useState('2027-03-15');
  const [polMember, setPolMember] = useState(state.members[0]?.id ?? 'm-shared');

  const [supportYears, setSupportYears] = useState(15);
  const [nomineeEdits, setNomineeEdits] = useState<Record<string, string>>({});

  // Emergency ("If Something Happens to Me") draft
  const [willLocation, setWillLocation] = useState(state.emergencyInfo?.willLocation ?? '');
  const [bankLockerInfo, setBankLockerInfo] = useState(state.emergencyInfo?.bankLockerInfo ?? '');
  const [advisorContact, setAdvisorContact] = useState(state.emergencyInfo?.advisorContact ?? '');
  const [nomineeNotes, setNomineeNotes] = useState(state.emergencyInfo?.nomineeNotes ?? '');
  const [safetyErr, setSafetyErr] = useState('');

  const totalDebtBalance = state.debts.reduce((s, d) => s + d.currentBalance, 0);
  const needsAnnual = useMemo(() => {
    const exp = computeCategorySpending(
      state.transactions,
      state.categories,
      selectedMonth,
      'expense',
      'all'
    );
    const monthlyNeeds = exp
      .filter((c) => c.category.bucket === 'needs')
      .reduce((s, c) => s + c.spent, 0);
    return Math.max(12000, monthlyNeeds * 12);
  }, [state.transactions, state.categories, selectedMonth]);

  const adequacy = useMemo(
    () =>
      computeInsuranceAdequacy({
        accounts: state.accounts,
        policies: state.policies ?? [],
        goals: state.goals,
        totalDebtBalance,
        annualEssentialExpenses: needsAnnual,
        supportYears,
        baseCurrency,
        exchangeRates: state.settings.exchangeRates,
        transactions: state.transactions,
      }),
    [
      state.accounts,
      state.policies,
      state.goals,
      totalDebtBalance,
      needsAnnual,
      supportYears,
      baseCurrency,
      state.settings.exchangeRates,
      state.transactions,
    ]
  );

  const handleAddPolicy = (e: React.FormEvent) => {
    e.preventDefault();
    const cover = parseFloat(polCover);
    if (!polName.trim() || Number.isNaN(cover) || cover <= 0) return;
    upsertPolicy({
      id: `pol-${Date.now()}`,
      name: polName.trim(),
      insurer: polInsurer.trim() || t('acc.manualFallback'),
      type: polType,
      coverAmount: cover,
      annualPremium: parseFloat(polPremium) || 0,
      currency: baseCurrency,
      insuredMemberId: polMember,
      nomineeName: polNominee.trim() || undefined,
      renewalDate: polRenewal,
    });
    setPolName('');
    setPolInsurer('');
    setPolNominee('');
  };

  const handleSaveEmergency = (e: React.FormEvent) => {
    e.preventDefault();
    const combined = `${willLocation}\n${bankLockerInfo}\n${advisorContact}\n${nomineeNotes}`;
    if (containsSensitiveCredentialHint(combined)) {
      setSafetyErr(t('safe.errNoPasswords'));
      return;
    }
    setSafetyErr('');
    updateEmergencyInfo({
      willLocation: willLocation.trim(),
      bankLockerInfo: bankLockerInfo.trim(),
      advisorContact: advisorContact.trim(),
      nomineeNotes: nomineeNotes.trim(),
      updatedAt: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#131b2e] dark:text-white">
            {t('safe.title')}
          </h1>
          <p className="text-sm text-[#404944] dark:text-[#707974]">{t('safe.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="no-print inline-flex items-center gap-1.5 rounded-xl bg-[#064E3B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#043D2E]"
        >
          <Printer className="h-4 w-4" />
          {t('safe.printPackBtn')}
        </button>
      </div>

      {/* Term & Health Adequacy Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="wdw-card p-4">
          <div className="text-xs font-semibold text-[#404944]">{t('safe.termNeeded')}</div>
          <div className="mt-1 font-numeric text-xl font-bold text-[#131b2e] dark:text-white">
            {formatMoney(adequacy.recommendedTermCover, baseCurrency, privacyMode)}
          </div>
          <label className="mt-2 flex items-center justify-between text-[11px] text-[#404944]">
            <span>{t('safe.supportYearsLabel', { y: supportYears })}</span>
            <input
              type="range"
              min={10}
              max={25}
              value={supportYears}
              onChange={(e) => setSupportYears(Number(e.target.value))}
              className="w-20 accent-emerald-600"
            />
          </label>
        </div>
        <div className="wdw-card p-4">
          <div className="text-xs font-semibold text-[#404944]">{t('safe.termHeld')}</div>
          <div className="mt-1 font-numeric text-xl font-bold text-[#10B981] dark:text-emerald-400">
            {formatMoney(adequacy.currentTermCover, baseCurrency, privacyMode)}
          </div>
        </div>
        <div
          className={`rounded-2xl border p-4 ${
            adequacy.termGap > 0
              ? 'border-rose-200 bg-[#ffdad6]/50 dark:border-rose-900 dark:bg-rose-950/30'
              : 'border-emerald-200 bg-[#b0f0d6]/30 dark:border-emerald-900 dark:bg-emerald-950/30'
          }`}
        >
          <div className="text-xs font-semibold text-[#404944] dark:text-[#bfc9c3]">
            {t('safe.protectionGap')}
          </div>
          <div
            className={`mt-1 font-numeric text-xl font-bold ${
              adequacy.termGap > 0 ? 'text-[#ba1a1a]' : 'text-[#10B981]'
            }`}
          >
            {adequacy.termGap === 0
              ? t('safe.fullyCovered')
              : formatMoney(adequacy.termGap, baseCurrency, privacyMode)}
          </div>
        </div>
        <div className="wdw-card p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#404944]">
            <HeartPulse className="h-3.5 w-3.5 text-[#0F766E]" />
            {t('safe.healthHeld')}
          </div>
          <div className="mt-1 font-numeric text-xl font-bold text-[#0F766E] dark:text-[#6ac0b6]">
            {formatMoney(adequacy.currentHealthCover, baseCurrency, privacyMode)}
          </div>
        </div>
      </div>

      {/* Nominee Gap Audit */}
      <div
        data-testid="nominee-audit-section"
        className="wdw-card p-5"
      >
        <div className="mb-3 flex items-center gap-2">
          {adequacy.missingNomineeAccounts.length + adequacy.missingNomineePolicies.length > 0 ? (
            <ShieldAlert className="h-5 w-5 text-amber-500" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
          )}
          <h2 className="text-base font-bold text-[#131b2e] dark:text-white">
            {t('safe.nomineeAuditTitle')}
          </h2>
        </div>

        {adequacy.missingNomineeAccounts.length + adequacy.missingNomineePolicies.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl bg-[#b0f0d6]/35 px-3.5 py-2.5 text-xs font-semibold text-[#064E3B] dark:bg-emerald-950/30 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            {t('safe.allNomineesSet')}
          </div>
        ) : (
          <div className="space-y-2">
            {adequacy.missingNomineeAccounts.map((acc) => (
              <div
                key={acc.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#FCD34D] bg-[#FEF3C7]/70 px-3.5 py-2.5 text-xs dark:border-amber-900/60 dark:bg-amber-950/20"
              >
                <div className="flex items-center gap-2 font-semibold text-[#663500] dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 text-[#D97706]" />
                  <span>
                    {accName(acc)} — {t('safe.missingNomineeLabel')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={nomineeEdits[acc.id] ?? ''}
                    onChange={(e) =>
                      setNomineeEdits((prev) => ({ ...prev, [acc.id]: e.target.value }))
                    }
                    placeholder={t('safe.nomineePlaceholder')}
                    className="rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = (nomineeEdits[acc.id] ?? '').trim();
                      if (!val) return;
                      upsertAccount({ ...acc, nomineeName: val });
                    }}
                    className="rounded-lg bg-[#064E3B] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#043D2E]"
                  >
                    {t('safe.assignNomineeBtn')}
                  </button>
                </div>
              </div>
            ))}
            {adequacy.missingNomineePolicies.map((pol) => {
              const editKey = `policy:${pol.id}`;
              return (
                <div
                  key={editKey}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#FCD34D] bg-[#FEF3C7]/70 px-3.5 py-2.5 text-xs dark:border-amber-900/60 dark:bg-amber-950/20"
                >
                  <div className="flex items-center gap-2 font-semibold text-[#663500] dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4 text-[#D97706]" />
                    <span>
                      {entityText(pol.name)} — {t('safe.missingNomineeLabel')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={nomineeEdits[editKey] ?? ''}
                      onChange={(e) =>
                        setNomineeEdits((prev) => ({ ...prev, [editKey]: e.target.value }))
                      }
                      placeholder={t('safe.nomineePlaceholder')}
                      className="rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = (nomineeEdits[editKey] ?? '').trim();
                        if (!val) return;
                        upsertPolicy({ ...pol, nomineeName: val });
                      }}
                      className="rounded-lg bg-[#064E3B] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#043D2E]"
                    >
                      {t('safe.assignNomineeBtn')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Insurance Policies Manager */}
      <div className="wdw-card p-5">
        <h2 className="mb-3 text-base font-bold text-[#131b2e] dark:text-white">
          {t('safe.policiesHeading')}
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(state.policies ?? []).map((p) => {
            const insured = state.members.find((m) => m.id === p.insuredMemberId);
            return (
              <div
                key={p.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-[#F1F5F9] p-3.5 dark:border-[#232f4f]"
              >
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-[#131b2e] dark:text-white">
                    <span>{entityText(p.name)}</span>
                    <span className="rounded bg-[#f2f3ff] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#064E3B] dark:bg-[#004d47]/40 dark:text-[#9cf2e8]">
                      {policyTypeLabel(p.type)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-[#404944]">
                    {p.insurer} • {memName(insured)} •{' '}
                    {p.nomineeName
                      ? t('safe.nomineeTag', { name: p.nomineeName })
                      : t('safe.missingNomineeLabel')}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-[#131b2e] dark:text-[#bfc9c3]">
                    {t('safe.coverPremiumLine', {
                      cover: formatMoney(p.coverAmount, p.currency, privacyMode),
                      prem: formatMoney(p.annualPremium, p.currency, privacyMode),
                      date: p.renewalDate,
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deletePolicy(p.id)}
                  className="rounded p-1 text-[#707974] hover:text-[#ba1a1a]"
                  aria-label={t('safe.deletePolicyAria', { name: p.name })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        <form
          onSubmit={handleAddPolicy}
          className="mt-4 grid grid-cols-1 gap-2 border-t border-[#F1F5F9] pt-4 sm:grid-cols-4 dark:border-[#232f4f]"
        >
          <input
            type="text"
            required
            value={polName}
            onChange={(e) => setPolName(e.target.value)}
            placeholder={t('safe.polNamePlaceholder')}
            className="rounded-xl border border-[#CBD5E1] px-3 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
          />
          <input
            type="text"
            value={polInsurer}
            onChange={(e) => setPolInsurer(e.target.value)}
            placeholder={t('safe.insurerPlaceholder')}
            className="rounded-xl border border-[#CBD5E1] px-3 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
          />
          <select
            value={polType}
            onChange={(e) => setPolType(e.target.value as InsuranceType)}
            className="rounded-xl border border-[#CBD5E1] px-2.5 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
          >
            {(['term', 'health', 'endowment', 'vehicle'] as const).map((pt) => (
              <option key={pt} value={pt}>
                {policyTypeLabel(pt)}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            required
            value={polCover}
            onChange={(e) => setPolCover(e.target.value)}
            placeholder={t('safe.coverPlaceholder')}
            className="rounded-xl border border-[#CBD5E1] px-3 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
          />
          <input
            type="number"
            min="0"
            value={polPremium}
            onChange={(e) => setPolPremium(e.target.value)}
            placeholder={t('safe.premPlaceholder')}
            className="rounded-xl border border-[#CBD5E1] px-3 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
          />
          <select
            value={polMember}
            onChange={(e) => setPolMember(e.target.value)}
            className="rounded-xl border border-[#CBD5E1] px-2.5 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
          >
            {state.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.avatar} {memName(m)}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={polNominee}
            onChange={(e) => setPolNominee(e.target.value)}
            placeholder={t('safe.nomineePlaceholder')}
            className="rounded-xl border border-[#CBD5E1] px-3 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={polRenewal}
              onChange={(e) => setPolRenewal(e.target.value)}
              className="flex-1 rounded-xl border border-[#CBD5E1] px-2 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-xl bg-[#064E3B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#043D2E]"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('safe.addPolicyBtn')}
            </button>
          </div>
        </form>
      </div>

      {/* Emergency "If Something Happens to Me" Pack */}
      <form
        onSubmit={handleSaveEmergency}
        className="wdw-card p-5"
      >
        <div className="mb-2 flex items-center gap-2">
          <FileText className="h-5 w-5 text-[#10B981]" />
          <h2 className="text-base font-bold text-[#131b2e] dark:text-white">
            {t('safe.emergencyHeading')}
          </h2>
        </div>
        <p className="mb-4 rounded-xl bg-[#FEF3C7] px-3 py-2 text-xs font-medium text-[#904d00] dark:bg-amber-950/30 dark:text-amber-200">
          {t('safe.neverPasswordsGuard')}
        </p>

        {safetyErr && (
          <p className="mb-3 rounded-lg bg-[#ffdad6]/70 px-3 py-2 text-xs font-semibold text-[#93000a] dark:bg-rose-950/40 dark:text-rose-300">
            {safetyErr}
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block text-xs">
            <span className="mb-1 block font-semibold">{t('safe.willLabel')}</span>
            <input
              type="text"
              value={willLocation}
              onChange={(e) => setWillLocation(e.target.value)}
              className="w-full rounded-xl border border-[#CBD5E1] px-3 py-2 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold">{t('safe.lockerLabel')}</span>
            <input
              type="text"
              value={bankLockerInfo}
              onChange={(e) => setBankLockerInfo(e.target.value)}
              className="w-full rounded-xl border border-[#CBD5E1] px-3 py-2 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold">{t('safe.advisorLabel')}</span>
            <input
              type="text"
              value={advisorContact}
              onChange={(e) => setAdvisorContact(e.target.value)}
              className="w-full rounded-xl border border-[#CBD5E1] px-3 py-2 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold">{t('safe.notesLabel')}</span>
            <input
              type="text"
              value={nomineeNotes}
              onChange={(e) => setNomineeNotes(e.target.value)}
              className="w-full rounded-xl border border-[#CBD5E1] px-3 py-2 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            className="rounded-xl bg-[#064E3B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#043D2E]"
          >
            {t('safe.saveEmergencyBtn')}
          </button>
        </div>
      </form>
    </div>
  );
};
