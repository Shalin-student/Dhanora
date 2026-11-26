import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Lock,
  Shield,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import type { AccountRole, CurrencyCode, PlanTier } from '../types/finance';
import { DEMO_ACCOUNT_PRESETS, evaluatePasswordStrength } from '../utils/auth';
import { inspectServerInvite, confirmPasswordReset, requestPasswordReset } from '../storage/syncClient';
import { LanguageToggle } from './LanguageToggle';
import { BrandMark } from './BrandMark';
import { useI18n } from '../i18n/useI18n';

export type AuthScreenMode = 'signin' | 'signup' | 'forgot' | 'reset';

export const AuthPages: React.FC<{
  initialMode?: AuthScreenMode;
  initialPlan?: PlanTier;
  initialInviteCode?: string;
  initialResetToken?: string;
  onBackHome: () => void;
}> = ({
  initialMode = 'signin',
  initialPlan = 'free',
  initialInviteCode,
  initialResetToken,
  onBackHome,
}) => {
  const { signInWithCredentials, signUpWithAccount, enterGuestDemo, getAuthSyncConfig } =
    useFinance();
  const { t, roleLabel } = useI18n();

  const [mode, setMode] = useState<AuthScreenMode>(initialResetToken ? 'reset' : initialMode);
  const [name, setName] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState(initialResetToken ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [role, setRole] = useState<AccountRole>('admin');
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('INR');
  const [inviteCode, setInviteCode] = useState(initialInviteCode ?? '');
  const [showRoleInviteDrawer, setShowRoleInviteDrawer] = useState(Boolean(initialInviteCode));
  const [showDemoDrawer, setShowDemoDrawer] = useState(false);
  const [invitePreview, setInvitePreview] = useState<{
    householdName: string;
    role: AccountRole;
    invitedEmail?: string | null;
  } | null>(null);
  const [consentPrivacy, setConsentPrivacy] = useState(true);
  const [consentTerms, setConsentTerms] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const intendedUpgrade = initialPlan === 'plus' || initialPlan === 'advisor';
  const intendedPlanName =
    initialPlan === 'advisor' ? t('price.advisorName') : t('price.plusName');

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
      setShowRoleInviteDrawer(true);
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
    setInfoMsg('');

    if (mode === 'forgot') {
      if (!email.trim().includes('@')) {
        setErrorMsg(t('auth.errInvalidFields'));
        return;
      }
      setSubmitting(true);
      const res = await requestPasswordReset(email.trim(), getAuthSyncConfig());
      setSubmitting(false);
      if (res?.ok) {
        setInfoMsg(
          res.delivery === 'email_not_configured' ? t('auth.resetNoEmailNote') : t('auth.resetSentMsg')
        );
      } else {
        setInfoMsg(t('auth.resetNoEmailNote'));
      }
      return;
    }

    if (mode === 'reset') {
      if (newPassword.length < 6 || !resetToken.trim()) {
        setErrorMsg(t('auth.errResetInvalid'));
        return;
      }
      setSubmitting(true);
      const res = await confirmPasswordReset(
        { token: resetToken.trim(), newPassword },
        getAuthSyncConfig()
      );
      setSubmitting(false);
      if (!res?.ok) {
        setErrorMsg(t('auth.errResetInvalid'));
        return;
      }
      setInfoMsg(t('auth.pwUpdatedMsg'));
      setMode('signin');
      setPassword('');
      setNewPassword('');
      return;
    }

    if (mode === 'signup' && (!consentPrivacy || !consentTerms)) {
      setErrorMsg(t('auth.errConsentRequired'));
      return;
    }

    const redirectView = intendedUpgrade ? ('pricing' as const) : undefined;
    setSubmitting(true);
    if (mode === 'signin') {
      const res = await signInWithCredentials(email, password, redirectView);
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
      planTier: 'free',
      householdName,
      inviteCode: inviteCode.trim() || undefined,
      baseCurrency,
      redirectView,
    });
    setSubmitting(false);
    if (!res.ok) {
      setErrorMsg(t((res.errorKey as 'auth.errInvalidFields') || 'auth.errInvalidFields'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 bg-mesh-hero dark:bg-slate-950">
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
        {/* Left Trust & Value Panel */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95 lg:col-span-5">
          <div>
            <div className="flex items-center gap-2.5">
              <BrandMark size="md" />
              <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                {t('brand.name')}
              </span>
            </div>

            <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t('auth.trustBadge')}
            </div>

            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {mode === 'signin' ? t('auth.signinTitle') : t('auth.signupTitle')}
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {t('auth.roleAutoNote')}
            </p>

            {/* Clean Fintech Trust Cards */}
            <div className="mt-6 space-y-3">
              <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <Lock className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {t('auth.trustCard1Title')}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {t('auth.trustCard1Desc')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                  <Shield className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {t('auth.trustCard2Title')}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {t('auth.trustCard2Desc')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                  <Users className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {t('auth.trustCard3Title')}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {t('auth.trustCard3Desc')}
                  </p>
                </div>
              </div>
            </div>

            {/* Clean Collapsible Demo Role Drawer */}
            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowDemoDrawer((v) => !v)}
                aria-expanded={showDemoDrawer}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200"
              >
                <span className="inline-flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-emerald-600" />
                  {t('auth.demoDrawerToggle')}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-400 transition ${
                    showDemoDrawer ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {showDemoDrawer && (
                <div className="mt-2.5 grid grid-cols-1 gap-2">
                  {DEMO_ACCOUNT_PRESETS.map((preset, idx) => (
                    <button
                      key={preset.email}
                      type="button"
                      onClick={() => enterGuestDemo(idx)}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs transition hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-700"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{preset.avatar}</span>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {preset.name}
                          </div>
                          <div className="text-[10px] text-slate-500">{preset.email}</div>
                        </div>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-slate-800 dark:text-emerald-300">
                        {preset.role === 'advisor'
                          ? t('auth.roleAdvisorBadge')
                          : roleLabel(preset.role)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="mt-6 text-[11px] text-slate-500 dark:text-slate-400">
            {t('auth.privacyFooter')}
          </p>
        </div>

        {/* Right Clean Auth Form Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-7 sm:p-8">
          <div className="mb-6 flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-800/70">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg('');
                setInfoMsg('');
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
                setInfoMsg('');
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

          {intendedUpgrade && mode !== 'forgot' && mode !== 'reset' && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>{t('auth.pendingUpgradeBanner', { plan: intendedPlanName })}</span>
            </div>
          )}

          {infoMsg && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
              {infoMsg}
            </div>
          )}

          {errorMsg && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          {(mode === 'forgot' || mode === 'reset') ? (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {t('auth.forgotTitle')}
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t('auth.forgotSub')}
                </p>
              </div>

              {mode === 'forgot' ? (
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
              ) : (
                <>
                  <label className="block text-xs">
                    <span className="mb-1 block font-semibold text-slate-700 dark:text-slate-200">
                      {t('auth.resetTokenLabel')}
                    </span>
                    <input
                      type="text"
                      required
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1 block font-semibold text-slate-700 dark:text-slate-200">
                      {t('auth.newPwLabel')}
                    </span>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t('auth.passwordPlaceholder')}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>
                </>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-60"
              >
                {submitting
                  ? t('lock.verifying')
                  : mode === 'forgot'
                  ? t('auth.sendResetBtn')
                  : t('auth.updatePwBtn')}
              </button>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMsg('');
                  }}
                  className="font-semibold text-slate-600 hover:text-emerald-600 dark:text-slate-300"
                >
                  {t('auth.backToSignIn')}
                </button>
                {mode === 'forgot' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      setErrorMsg('');
                    }}
                    className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    {t('auth.haveTokenBtn')}
                  </button>
                )}
              </div>
            </form>
          ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {mode === 'signup' && (
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

            <div className="block text-xs">
              <div className="mb-1 flex items-center justify-between font-semibold text-slate-700 dark:text-slate-200">
                <label htmlFor="auth-password-input">{t('auth.passwordLabel')}</label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMsg('');
                      setInfoMsg('');
                    }}
                    className="text-[11px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    {t('auth.forgotPwLink')}
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-2.5 left-3 h-3.5 w-3.5 text-slate-400" />
                <input
                  id="auth-password-input"
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
            </div>

            {mode === 'signup' && (
              <>
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

                <div>
                  <button
                    type="button"
                    onClick={() => setShowRoleInviteDrawer((v) => !v)}
                    aria-expanded={showRoleInviteDrawer}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition ${
                        showRoleInviteDrawer ? 'rotate-180' : ''
                      }`}
                    />
                    <span>{t('auth.advancedOptionsToggle')}</span>
                  </button>

                  {showRoleInviteDrawer && (
                    <div className="mt-2.5 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-800/40">
                      <label className="block text-xs">
                        <span className="mb-1 block font-semibold text-slate-700 dark:text-slate-200">
                          {t('auth.accountRoleLabel')}
                        </span>
                        <select
                          aria-label={t('auth.accountRoleLabel')}
                          value={role}
                          disabled={Boolean(invitePreview)}
                          onChange={(e) => setRole(e.target.value as AccountRole)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800"
                        >
                          <option value="admin">{t('auth.roleAdminOpt')}</option>
                          <option value="partner">{t('auth.rolePartnerOpt')}</option>
                          <option value="dependent">{t('auth.roleDependentOpt')}</option>
                          <option value="advisor">{t('auth.roleAdvisorOpt')}</option>
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
                          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                        />
                      </label>
                    </div>
                  )}
                </div>

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
              </>
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
          )}

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
