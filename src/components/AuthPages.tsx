import React, { useEffect, useState } from 'react';
import {
  Calculator,
  ChevronDown,
  Eye,
  EyeOff,
  FileCheck2,
  KeyRound,
  Link2,
  Lock,
  Receipt,
  Shield,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import type { AccountRole, CurrencyCode, PlanTier, PublicLegalPage } from '../types/finance';
import { DEMO_ACCOUNT_PRESETS, evaluatePasswordStrength } from '../utils/auth';
import {
  buildGoogleOAuthStartUrl,
  confirmPasswordReset,
  inspectServerInvite,
  requestPasswordReset,
} from '../storage/syncClient';
import { LanguageToggle } from './LanguageToggle';
import { BrandLogoButton } from './BrandMark';
import { useI18n } from '../i18n/useI18n';

export type AuthScreenMode = 'signin' | 'signup' | 'forgot' | 'reset';

const GoogleLogoIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    aria-hidden="true"
    className="shrink-0"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

export const AuthPages: React.FC<{
  initialMode?: AuthScreenMode;
  initialPlan?: PlanTier;
  initialInviteCode?: string;
  initialResetToken?: string;
  onBackHome: () => void;
  onOpenLegal?: (page: PublicLegalPage) => void;
}> = ({
  initialMode = 'signin',
  initialPlan = 'free',
  initialInviteCode,
  initialResetToken,
  onBackHome,
  onOpenLegal,
}) => {
  const {
    state,
    isOnline,
    signInWithCredentials,
    signUpWithAccount,
    enterGuestDemo,
    getAuthSyncConfig,
    oauthNotice,
    dismissOauthNotice,
    setOauthNoticeCode,
  } = useFinance();
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

  const handleLogoClick = () => {
    setShowRoleInviteDrawer(false);
    setShowDemoDrawer(false);
    onBackHome();
  };

  const handleContinueWithGoogle = () => {
    setErrorMsg('');
    setInfoMsg('');
    const offline =
      !isOnline || (typeof navigator !== 'undefined' && navigator.onLine === false);
    if (offline) {
      setOauthNoticeCode('google_offline', 'error');
      return;
    }
    const startUrl = buildGoogleOAuthStartUrl({
      serverUrl: state.settings.syncServerUrl,
      mode: mode === 'signup' ? 'signup' : 'signin',
      inviteCode: inviteCode.trim() || undefined,
      plan: intendedUpgrade ? initialPlan : undefined,
    });
    try {
      window.location.assign(startUrl);
    } catch {
      // ignore navigation exceptions in test environments
    }
  };

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
    <div className="grid min-h-screen grid-cols-1 overflow-x-clip bg-[#ffffff] text-[#131b2e] lg:grid-cols-2">
      {/* Left Column: Centered Mobbin-Style Pure Snow Auth Form */}
      <div className="flex flex-col justify-center bg-[#ffffff] text-[#131b2e]">
        <div className="mx-auto w-full max-w-[420px] px-5 py-8 sm:px-6 sm:py-10">
          {/* Top Brand + Language Switcher */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
            <BrandLogoButton
              size="md"
              forceLight
              ariaLabel={`${t('brand.name')} — ${t('auth.backHome')}`}
              onClick={handleLogoClick}
            />
            <LanguageToggle variant="pill" forceLight />
          </div>

          {/* Heading & 1-line Subtitle */}
          <div className="mb-5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-[#131b2e]">
              {mode === 'forgot' || mode === 'reset'
                ? t('auth.forgotTitle')
                : mode === 'signin'
                ? t('auth.signinTitle')
                : t('auth.signupTitle')}
            </h1>
            <p className="mt-1.5 text-xs leading-relaxed text-[#404944]">
              {mode === 'forgot' || mode === 'reset'
                ? t('auth.forgotSub')
                : mode === 'signin'
                ? t('auth.signinSub')
                : t('auth.signupSub')}
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="mb-5 flex rounded-xl border border-[#e3dfeb] bg-[#f3f0fc] p-1">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg('');
                setInfoMsg('');
              }}
              className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                mode === 'signin'
                  ? 'bg-[#ffffff] text-[#003527] shadow-xs'
                  : 'text-[#404944] hover:text-[#131b2e]'
              }`}
            >
              <UserCheck className="h-3.5 w-3.5 shrink-0" />
              <span>{t('auth.tabSignIn')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg('');
                setInfoMsg('');
              }}
              className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                mode === 'signup'
                  ? 'bg-[#ffffff] text-[#003527] shadow-xs'
                  : 'text-[#404944] hover:text-[#131b2e]'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5 shrink-0" />
              <span>{t('auth.tabSignUp')}</span>
            </button>
          </div>

          {/* Dismissible OAuth Fallback / Error Banner */}
          {oauthNotice && (
            <div
              role={oauthNotice.type === 'error' ? 'alert' : 'status'}
              className={`mb-4 flex items-start justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
                oauthNotice.type === 'error'
                  ? 'border-[#ba1a1a]/30 bg-[#ffdad6] text-[#93000a]'
                  : 'border-[#FCD34D] bg-[#FEF3C7] text-[#904d00]'
              }`}
            >
              <span className="py-2 leading-relaxed">{oauthNotice.message}</span>
              <button
                type="button"
                onClick={dismissOauthNotice}
                aria-label={t('auth.dismissNoticeAria')}
                className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg hover:bg-black/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Pending Upgrade Plan Banner */}
          {intendedUpgrade && mode !== 'forgot' && mode !== 'reset' && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#FCD34D] bg-[#FEF3C7] px-3.5 py-2.5 text-xs font-semibold text-[#904d00]">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#D97706]" />
              <span>{t('auth.pendingUpgradeBanner', { plan: intendedPlanName })}</span>
            </div>
          )}

          {infoMsg && (
            <div className="mb-4 rounded-xl border border-[#10B981]/40 bg-[#b0f0d6]/35 px-3.5 py-2.5 text-xs font-semibold text-[#064E3B]">
              {infoMsg}
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-[#ba1a1a]/30 bg-[#ffdad6] px-3.5 py-2.5 text-xs font-semibold text-[#93000a]"
            >
              {errorMsg}
            </div>
          )}

          {mode === 'forgot' || mode === 'reset' ? (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              {mode === 'forgot' ? (
                <label className="block text-xs">
                  <span className="mb-1.5 block font-semibold text-[#131b2e]">
                    {t('auth.emailLabel')}
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="min-h-[44px] w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3.5 py-2 text-xs text-[#131b2e]"
                  />
                </label>
              ) : (
                <>
                  <label className="block text-xs">
                    <span className="mb-1.5 block font-semibold text-[#131b2e]">
                      {t('auth.resetTokenLabel')}
                    </span>
                    <input
                      type="text"
                      required
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      className="font-numeric min-h-[44px] w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3.5 py-2 text-xs text-[#131b2e]"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1.5 block font-semibold text-[#131b2e]">
                      {t('auth.newPwLabel')}
                    </span>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t('auth.passwordPlaceholder')}
                      className="min-h-[44px] w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3.5 py-2 text-xs text-[#131b2e]"
                    />
                  </label>
                </>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex min-h-[44px] h-11 w-full items-center justify-center rounded-xl bg-[#003527] px-4 text-sm font-bold text-[#ffffff] shadow-xs transition hover:bg-[#064E3B] disabled:opacity-60"
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
                  className="inline-flex min-h-[44px] items-center font-semibold text-[#404944] hover:text-[#003527]"
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
                    className="inline-flex min-h-[44px] items-center font-semibold text-[#0F766E] hover:underline"
                  >
                    {t('auth.haveTokenBtn')}
                  </button>
                )}
              </div>
            </form>
          ) : (
            <>
              {/* Continue with Google OAuth CTA */}
              <button
                type="button"
                onClick={handleContinueWithGoogle}
                className="flex min-h-[44px] h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-[#e3dfeb] bg-[#ffffff] px-4 text-sm font-semibold text-[#131b2e] shadow-2xs transition hover:bg-[#faf8ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E]"
              >
                <GoogleLogoIcon />
                <span>{t('auth.continueWithGoogle')}</span>
              </button>

              {/* Horizontal "or" divider */}
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-[#e3dfeb]" />
                <span className="text-xs font-medium text-[#707974]">{t('auth.orDivider')}</span>
                <div className="h-px flex-1 bg-[#e3dfeb]" />
              </div>

              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
                {mode === 'signup' && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block text-xs">
                      <span className="mb-1 block font-semibold text-[#131b2e]">
                        {t('auth.fullName')}
                      </span>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t('auth.namePlaceholder')}
                        className="min-h-[44px] w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3.5 py-2 text-xs text-[#131b2e]"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="mb-1 block font-semibold text-[#131b2e]">
                        {t('auth.householdLabel')}
                      </span>
                      <input
                        type="text"
                        value={householdName}
                        onChange={(e) => setHouseholdName(e.target.value)}
                        placeholder={t('auth.householdPlaceholder')}
                        className="min-h-[44px] w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3.5 py-2 text-xs text-[#131b2e]"
                      />
                    </label>
                  </div>
                )}

                <label className="block text-xs">
                  <span className="mb-1 block font-semibold text-[#131b2e]">
                    {t('auth.emailLabel')}
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="min-h-[44px] w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3.5 py-2 text-xs text-[#131b2e]"
                  />
                </label>

                <div className="block text-xs">
                  <div className="mb-1 flex items-center justify-between font-semibold text-[#131b2e]">
                    <label htmlFor="auth-password-input">{t('auth.passwordLabel')}</label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setErrorMsg('');
                          setInfoMsg('');
                        }}
                        className="inline-flex min-h-[44px] items-center px-1 text-[11px] font-semibold text-[#0F766E] hover:underline"
                      >
                        {t('auth.forgotPwLink')}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute top-3.5 left-3 h-3.5 w-3.5 text-[#707974]" />
                    <input
                      id="auth-password-input"
                      type={showPw ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('auth.passwordPlaceholder')}
                      className="min-h-[44px] w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] py-2 pr-12 pl-9 text-xs text-[#131b2e]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute top-0 right-0 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-r-xl text-[#707974] hover:text-[#131b2e]"
                      aria-label={t('auth.togglePwAria')}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {mode === 'signup' && password.length > 0 && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#f3f0fc]">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pwStrength.score >= 3
                              ? 'bg-[#10B981]'
                              : pwStrength.score === 2
                              ? 'bg-[#D97706]'
                              : 'bg-[#ba1a1a]'
                          }`}
                          style={{ width: `${pwStrength.score * 25}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-[#404944]">
                        {t(pwStrength.labelKey)}
                      </span>
                    </div>
                  )}
                </div>

                {mode === 'signup' && (
                  <>
                    <label className="block text-xs">
                      <span className="mb-1 block font-semibold text-[#131b2e]">
                        {t('auth.currencyLabel')}
                      </span>
                      <select
                        aria-label={t('auth.currencyLabel')}
                        value={baseCurrency}
                        onChange={(e) => setBaseCurrency(e.target.value as CurrencyCode)}
                        className="min-h-[44px] w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-2 text-xs font-semibold text-[#131b2e]"
                      >
                        <option value="INR">INR (₹)</option>
                        <option value="USD">USD ($)</option>
                      </select>
                    </label>

                    {invitePreview && (
                      <div className="flex items-center gap-2 rounded-xl border border-[#10B981]/40 bg-[#b0f0d6]/30 px-3 py-2 text-xs font-semibold text-[#064E3B]">
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
                        className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-semibold text-[#0F766E] hover:underline"
                      >
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition ${
                            showRoleInviteDrawer ? 'rotate-180' : ''
                          }`}
                        />
                        <span>{t('auth.advancedOptionsToggle')}</span>
                      </button>

                      {showRoleInviteDrawer && (
                        <div className="mt-2 grid grid-cols-1 gap-3 rounded-2xl border border-[#e3dfeb] bg-[#faf8ff] p-3.5 sm:grid-cols-2">
                          <label className="block text-xs">
                            <span className="mb-1 block font-semibold text-[#131b2e]">
                              {t('auth.accountRoleLabel')}
                            </span>
                            <select
                              aria-label={t('auth.accountRoleLabel')}
                              value={role}
                              disabled={Boolean(invitePreview)}
                              onChange={(e) => setRole(e.target.value as AccountRole)}
                              className="min-h-[44px] w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-2 text-xs font-semibold text-[#131b2e] disabled:opacity-60"
                            >
                              <option value="admin">{t('auth.roleAdminOpt')}</option>
                              <option value="partner">{t('auth.rolePartnerOpt')}</option>
                              <option value="dependent">{t('auth.roleDependentOpt')}</option>
                              <option value="advisor">{t('auth.roleAdvisorOpt')}</option>
                            </select>
                          </label>

                          <label className="block text-xs">
                            <span className="mb-1 block font-semibold text-[#131b2e]">
                              {t('auth.inviteCodeLabel')}
                            </span>
                            <input
                              type="text"
                              value={inviteCode}
                              onChange={(e) => setInviteCode(e.target.value)}
                              placeholder={t('auth.inviteCodePlaceholder')}
                              className="min-h-[44px] w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3.5 py-2 text-xs text-[#131b2e]"
                            />
                          </label>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 rounded-xl border border-[#e3dfeb] bg-[#faf8ff] px-3 py-2 text-[11px] text-[#404944]">
                      <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={consentPrivacy}
                          onChange={(e) => setConsentPrivacy(e.target.checked)}
                          className="h-4 w-4 shrink-0 accent-[#003527]"
                        />
                        <span>{t('auth.consentPrivacy')}</span>
                      </label>
                      <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={consentTerms}
                          onChange={(e) => setConsentTerms(e.target.checked)}
                          className="h-4 w-4 shrink-0 accent-[#003527]"
                        />
                        <span>{t('auth.consentTerms')}</span>
                      </label>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex min-h-[44px] h-11 w-full items-center justify-center rounded-xl bg-[#003527] px-4 text-sm font-bold text-[#ffffff] shadow-xs transition hover:bg-[#064E3B] disabled:opacity-60"
                >
                  {submitting
                    ? t('lock.verifying')
                    : mode === 'signin'
                    ? t('auth.signInBtn')
                    : t('auth.createAccountBtn')}
                </button>
              </form>

              {/* Inline Legal Acknowledgment */}
              <p className="mt-3 text-center text-[11px] leading-relaxed text-[#404944]">
                {t('auth.legalAckPrefix')}{' '}
                <button
                  type="button"
                  onClick={() => onOpenLegal?.('terms')}
                  className="inline-flex min-h-[44px] items-center font-semibold text-[#003527] underline underline-offset-2 hover:text-[#0F766E]"
                >
                  {t('auth.legalTermsLink')}
                </button>{' '}
                &amp;{' '}
                <button
                  type="button"
                  onClick={() => onOpenLegal?.('privacy')}
                  className="inline-flex min-h-[44px] items-center font-semibold text-[#003527] underline underline-offset-2 hover:text-[#0F766E]"
                >
                  {t('auth.legalPrivacyLink')}
                </button>
                {t('auth.legalAckSuffix')}
              </p>

              {/* Mode Switch Prompt */}
              <div className="mt-1 flex flex-wrap items-center justify-center gap-1 text-xs text-[#404944]">
                <span>
                  {mode === 'signin'
                    ? t('auth.switchToSignupPrompt')
                    : t('auth.switchToSigninPrompt')}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'signin' ? 'signup' : 'signin');
                    setErrorMsg('');
                    setInfoMsg('');
                  }}
                  className="inline-flex min-h-[44px] items-center px-1.5 font-bold text-[#003527] hover:text-[#064E3B] hover:underline"
                >
                  {mode === 'signin'
                    ? t('auth.switchToSignupBtn')
                    : t('auth.switchToSigninBtn')}
                </button>
              </div>
            </>
          )}

          {/* Collapsible Explore Demo Roles (4 Personas) + Guest Demo CTA */}
          <div className="mt-4 border-t border-[#e3dfeb] pt-4">
            <button
              type="button"
              onClick={() => setShowDemoDrawer((v) => !v)}
              aria-expanded={showDemoDrawer}
              className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-[#e3dfeb] bg-[#faf8ff] px-3.5 py-2 text-xs font-semibold text-[#131b2e] transition hover:bg-[#f3f0fc]"
            >
              <span className="inline-flex items-center gap-2">
                <KeyRound className="h-3.5 w-3.5 text-[#003527]" />
                {t('auth.demoDrawerToggle')}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-[#404944] transition ${
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
                    className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-[#e3dfeb] bg-[#ffffff] px-3 py-2 text-left text-xs transition hover:border-[#0F766E] hover:bg-[#faf8ff]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{preset.avatar}</span>
                      <div>
                        <div className="font-semibold text-[#131b2e]">{preset.name}</div>
                        <div className="text-[10px] text-[#404944]">{preset.email}</div>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#003527]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#003527]">
                      {preset.role === 'advisor'
                        ? t('auth.roleAdvisorBadge')
                        : roleLabel(preset.role)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-2 text-center">
              <button
                type="button"
                onClick={() => enterGuestDemo(0)}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 px-3 text-xs font-semibold text-[#0F766E] hover:underline"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {t('auth.guestDemoBtn')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Warm Domestic Wealth Angled Multi-Card Product Montage */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-l border-[#e3dfeb] bg-[#f3f0fc] p-10 xl:p-14 lg:flex">
        {/* Soft Ambient WDW Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-[#003527]/8 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-[#D97706]/12 blur-3xl"
        />

        {/* Top Montage Header */}
        <div className="relative z-10 max-w-lg">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FCD34D] bg-[#FEF3C7] px-3.5 py-1 text-[11px] font-bold text-[#904d00]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#D97706]" />
            <span>{t('auth.montageBadge')}</span>
          </div>
          <h2 className="font-display mt-4 text-2xl font-bold tracking-tight text-[#131b2e] xl:text-3xl">
            {t('auth.montageTitle')}
          </h2>
        </div>

        {/* Custom Angled Multi-Card Dhanora Product Montage */}
        <div className="relative z-10 my-8 flex items-center justify-center">
          <div className="relative grid w-full max-w-[540px] grid-cols-2 gap-4">
            {/* Card 1: Family Pulse */}
            <div className="-rotate-2 rounded-2xl border border-[#e3dfeb] bg-[#ffffff] p-4 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F766E]">
                  {t('auth.montagePulseTitle')}
                </span>
                <TrendingUp className="h-4 w-4 text-[#003527]" aria-hidden="true" />
              </div>
              <div className="font-numeric mt-2 text-2xl font-extrabold text-[#131b2e]">
                ₹42.84L
              </div>
              <p className="mt-1 text-[11px] text-[#404944]">{t('auth.montagePulseSub')}</p>
              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-[#f3f0fc]">
                <div className="w-[46%] bg-[#003527]" />
                <div className="w-[22%] bg-[#D97706]" />
                <div className="w-[32%] bg-[#0F766E]" />
              </div>
            </div>

            {/* Card 2: SIP & FIRE */}
            <div className="translate-y-4 rotate-2 rounded-2xl border border-[#064E3B] bg-[#003527] p-4 text-[#ffffff] shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#b0f0d6]">
                  {t('auth.montageSipTitle')}
                </span>
                <Sparkles className="h-4 w-4 text-[#D97706]" aria-hidden="true" />
              </div>
              <div className="font-numeric mt-2 text-2xl font-extrabold text-[#ffffff]">
                ₹2.48 Cr
              </div>
              <p className="mt-1 text-[11px] text-[#b0f0d6]">{t('auth.montageSipSub')}</p>
              <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold text-[#FEF3C7]">
                <span>12% Step-Up · 20 Yrs</span>
              </div>
            </div>

            {/* Card 3: Nominee Shield */}
            <div className="-rotate-1 rounded-2xl border border-[#e3dfeb] bg-[#ffffff] p-4 shadow-md">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0F766E]/12 text-[#0F766E]">
                  <Shield className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-xs font-bold text-[#131b2e]">
                  {t('auth.montageShieldTitle')}
                </span>
              </div>
              <p className="mt-2 text-[11px] font-medium text-[#404944]">
                {t('auth.montageShieldSub')}
              </p>
              <div className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-[#b0f0d6]/45 px-2 py-0.5 text-[10px] font-bold text-[#064E3B]">
                <FileCheck2 className="h-3 w-3" aria-hidden="true" />
                <span>Nominee Pack Ready</span>
              </div>
            </div>

            {/* Card 4: GST / Rent vs Buy */}
            <div className="translate-y-2 rotate-1 rounded-2xl border border-[#FCD34D]/80 bg-[#ffffff] p-4 shadow-md">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FEF3C7] text-[#904d00]">
                  <Calculator className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-xs font-bold text-[#131b2e]">
                  {t('auth.montageCalcTitle')}
                </span>
              </div>
              <p className="mt-2 text-[11px] font-medium text-[#404944]">
                {t('auth.montageCalcSub')}
              </p>
            </div>

            {/* Card 5: Quick Receipt Scan (spanning bottom) */}
            <div className="col-span-2 -rotate-1 rounded-2xl border border-[#e3dfeb] bg-[#ffffff] p-4 shadow-md">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#003527] text-[#b0f0d6]">
                    <Receipt className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <div className="text-xs font-bold text-[#131b2e]">
                      {t('auth.montageReceiptTitle')}
                    </div>
                    <div className="text-[11px] text-[#404944]">{t('auth.montageReceiptSub')}</div>
                  </div>
                </div>
                <span className="rounded-full bg-[#faf8ff] px-2.5 py-1 text-[10px] font-bold text-[#003527] ring-1 ring-[#e3dfeb]">
                  100% Private
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Trust Anchor Badge Row */}
        <div className="relative z-10 space-y-3 border-t border-[#e3dfeb] pt-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-[#e3dfeb] bg-[#ffffff]/90 p-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#003527]">
                <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{t('auth.trustCard1Title')}</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-[#404944]">
                {t('auth.trustCard1Desc')}
              </p>
            </div>
            <div className="rounded-xl border border-[#e3dfeb] bg-[#ffffff]/90 p-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F766E]">
                <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{t('auth.trustCard2Title')}</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-[#404944]">
                {t('auth.trustCard2Desc')}
              </p>
            </div>
            <div className="rounded-xl border border-[#e3dfeb] bg-[#ffffff]/90 p-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#904d00]">
                <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{t('auth.trustCard3Title')}</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-[#404944]">
                {t('auth.trustCard3Desc')}
              </p>
            </div>
          </div>
          <p className="text-center text-[11px] font-semibold text-[#404944]">
            {t('auth.montageTrustLine')}
          </p>
        </div>
      </aside>
    </div>
  );
};
