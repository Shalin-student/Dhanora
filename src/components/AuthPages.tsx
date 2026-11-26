import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Link2,
  Lock,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import type { AccountRole, CurrencyCode, PlanTier } from '../types/finance';
import { DEMO_ACCOUNT_PRESETS, evaluatePasswordStrength } from '../utils/auth';
import { inspectServerInvite } from '../storage/syncClient';
import { LanguageToggle } from './LanguageToggle';
import { useI18n } from '../i18n/useI18n';

export type AuthScreenMode = 'signin' | 'signup';

export const AuthPages: React.FC<{
  initialMode?: AuthScreenMode;
  initialPlan?: PlanTier;
  initialInviteCode?: string;
  onBackHome: () => void;
}> = ({ initialMode = 'signin', initialPlan = 'free', initialInviteCode, onBackHome }) => {
  const { signInWithCredentials, signUpWithAccount, enterGuestDemo } = useFinance();
  const { t, roleLabel } = useI18n();

  const [mode, setMode] = useState<AuthScreenMode>(initialMode);
  const [name, setName] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [role, setRole] = useState<AccountRole>('admin');
  const [planTier, setPlanTier] = useState<PlanTier>(initialPlan);
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('INR');
  const [inviteCode, setInviteCode] = useState(initialInviteCode ?? '');
  const [invitePreview, setInvitePreview] = useState<{
    householdName: string;
    role: AccountRole;
    invitedEmail?: string | null;
  } | null>(null);
  const [consentPrivacy, setConsentPrivacy] = useState(true);
  const [consentTerms, setConsentTerms] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const clean = inviteCode.trim();
    if (!clean || clean.length < 6) {
      setInvitePreview(null);
      return;
    }
    let active = true;
    void inspectServerInvite(clean).then((info) => {
      if (!active || !info) {
        if (active) setInvitePreview(null);
        return;
      }
      setInvitePreview({
        householdName: info.householdName,
        role: info.role,
        invitedEmail: info.invitedEmail,
      });
      setRole(info.role);
      setHouseholdName(info.householdName);
      if (info.invitedEmail && !email) {
        setEmail(info.invitedEmail);
      }
    });
    return () => {
      active = false;
    };
  }, [inviteCode]);

  const pwStrength = evaluatePasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (mode === 'signup' && (!consentPrivacy || !consentTerms)) {
      setErrorMsg(t('auth.errConsentRequired'));
      return;
    }

    setSubmitting(true);
    if (mode === 'signin') {
      const res = await signInWithCredentials(email, password);
      setSubmitting(false);
      if (!res.ok) {
        setErrorMsg(t((res.errorKey as 'auth.errInvalidCreds') || 'auth.errInvalidCreds'));
      }
      return;
    }

    const res = await signUpWithAccount({
      name,
      email,
      password,
      role: invitePreview ? invitePreview.role : role,
      planTier,
      householdName,
      inviteCode: inviteCode.trim() || undefined,
      baseCurrency,
    });
    setSubmitting(false);
    if (!res.ok) {
      setErrorMsg(t((res.errorKey as 'auth.errInvalidFields') || 'auth.errInvalidFields'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-emerald-600 dark:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t('auth.backHome')}</span>
        </button>
        <div className="flex items-center gap-2">
          <LanguageToggle variant="pill" />
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-4 py-6 lg:grid-cols-12">
        {/* Left Value Proposition & Demo Role Auto-Detection Panel */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t('auth.trustBadge')}
            </div>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {mode === 'signin' ? t('auth.signinTitle') : t('auth.signupTitle')}
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {t('auth.roleAutoNote')}
            </p>

            <div className="mt-6 space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {t('auth.quickRoleHeading')}
              </div>
              {DEMO_ACCOUNT_PRESETS.map((preset, idx) => (
                <button
                  key={preset.email}
                  type="button"
                  onClick={() => enterGuestDemo(idx)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-left text-xs transition hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:border-emerald-700"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{preset.avatar}</span>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{preset.name}</div>
                      <div className="text-[11px] text-slate-500">{preset.email}</div>
                    </div>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-700 shadow-2xs dark:bg-slate-900 dark:text-emerald-300">
                    {preset.role === 'advisor'
                      ? t('auth.roleAdvisorBadge')
                      : roleLabel(preset.role)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-6 text-[11px] text-slate-500 dark:text-slate-400">
            {t('auth.privacyFooter')}
          </p>
        </div>

        {/* Right Auth Form Card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-7 sm:p-8">
          <div className="mb-6 flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-800/70">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg('');
              }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
                mode === 'signin'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-500'
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              {t('auth.tabSignIn')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg('');
              }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
                mode === 'signup'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-500'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              {t('auth.tabSignUp')}
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-xs">
                    <span className="mb-1 block font-semibold text-slate-700 dark:text-slate-200">
                      {t('auth.fullName')}
                    </span>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('auth.namePlaceholder')}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1 block font-semibold text-slate-700 dark:text-slate-200">
                      {t('auth.householdLabel')}
                    </span>
                    <input
                      type="text"
                      value={householdName}
                      onChange={(e) => setHouseholdName(e.target.value)}
                      placeholder={t('auth.householdPlaceholder')}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>
                </div>

                {invitePreview && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <Link2 className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {t('auth.inviteJoiningBanner', {
                        household: invitePreview.householdName,
                        role: roleLabel(invitePreview.role),
                      })}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-xs">
                    <span className="mb-1 block font-semibold text-slate-700 dark:text-slate-200">
                      {t('auth.accountRoleLabel')}
                    </span>
                    <select
                      aria-label={t('auth.accountRoleLabel')}
                      value={role}
                      disabled={Boolean(invitePreview)}
                      onChange={(e) => setRole(e.target.value as AccountRole)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="admin">{t('auth.roleAdminOpt')}</option>
                      <option value="partner">{t('auth.rolePartnerOpt')}</option>
                      <option value="dependent">{t('auth.roleDependentOpt')}</option>
                      <option value="advisor">{t('auth.roleAdvisorOpt')}</option>
                    </select>
                  </label>

                  <label className="block text-xs">
                    <span className="mb-1 block font-semibold text-slate-700 dark:text-slate-200">
                      {t('auth.planChoiceLabel')}
                    </span>
                    <select
                      aria-label={t('auth.planChoiceLabel')}
                      value={planTier}
                      onChange={(e) => setPlanTier(e.target.value as PlanTier)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="free">{t('price.freeName')}</option>
                      <option value="plus">{t('price.plusName')}</option>
                      <option value="advisor">{t('price.advisorName')}</option>
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-xs">
                    <span className="mb-1 block font-semibold text-slate-700 dark:text-slate-200">
                      {t('auth.currencyLabel')}
                    </span>
                    <select
                      aria-label={t('auth.currencyLabel')}
                      value={baseCurrency}
                      onChange={(e) => setBaseCurrency(e.target.value as CurrencyCode)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1 block font-semibold text-slate-700 dark:text-slate-200">
                      {t('auth.inviteCodeLabel')}
                    </span>
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder={t('auth.inviteCodePlaceholder')}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>
                </div>
              </>
            )}

            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-slate-700 dark:text-slate-200">
                {t('auth.emailLabel')}
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </label>

            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-slate-700 dark:text-slate-200">
                {t('auth.passwordLabel')}
              </span>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-2.5 left-3 h-3.5 w-3.5 text-slate-400" />
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.passwordPlaceholder')}
                  className="w-full rounded-xl border border-slate-300 py-2 pr-9 pl-9 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute top-2 right-2.5 text-slate-400 hover:text-slate-600"
                  aria-label={t('auth.togglePwAria')}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === 'signup' && password.length > 0 && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pwStrength.score >= 3
                          ? 'bg-emerald-500'
                          : pwStrength.score === 2
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${pwStrength.score * 25}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {t(pwStrength.labelKey)}
                  </span>
                </div>
              )}
            </label>

            {mode === 'signup' && (
              <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={consentPrivacy}
                    onChange={(e) => setConsentPrivacy(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>{t('auth.consentPrivacy')}</span>
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={consentTerms}
                    onChange={(e) => setConsentTerms(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>{t('auth.consentTerms')}</span>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting
                ? t('lock.verifying')
                : mode === 'signin'
                ? t('auth.signInBtn')
                : t('auth.createAccountBtn')}
            </button>
          </form>

          <div className="mt-5 border-t border-slate-100 pt-4 text-center dark:border-slate-800">
            <button
              type="button"
              onClick={() => enterGuestDemo(0)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t('auth.guestDemoBtn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
