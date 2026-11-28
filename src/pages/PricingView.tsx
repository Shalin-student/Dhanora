import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  CreditCard,
  Crown,
  Receipt,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import type { PlanTier } from '../types/finance';
import {
  buildGoogleOAuthStartUrl,
  completeSandboxCheckout,
  createBillingCheckout,
  fetchBillingHistory,
  startServerTrial,
  validatePromoCode,
  verifyRazorpayCheckout,
  type ServerInvoice,
} from '../storage/syncClient';
import { formatInvoiceMinorAmount } from '../utils/entitlements';
import { useI18n } from '../i18n/useI18n';

interface RazorpayWindow extends Window {
  Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
}

function loadRazorpayScript(): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false);
  if ((window as RazorpayWindow).Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export const PricingView: React.FC<{
  embedded?: boolean;
  onSelectPlanAuth?: (tier: PlanTier) => void;
}> = ({ embedded = false, onSelectPlanAuth }) => {
  const {
    state,
    authSession,
    isOnline,
    getAuthSyncConfig,
    upgradePlan,
    refreshSessionFromServer,
    pushToast,
    pendingPostAuthPlan,
    clearPendingPostAuthPlan,
  } = useFinance();
  const { t } = useI18n();
  const [billing, setBilling] = useState<'yearly' | 'monthly'>('yearly');
  const [priceCurrency, setPriceCurrency] = useState<'INR' | 'USD'>(
    state.settings.baseCurrency === 'USD' && !embedded ? 'USD' : 'INR'
  );
  const [gstNumber, setGstNumber] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discountPct: number } | null>(
    null
  );
  const [promoError, setPromoError] = useState('');
  const [invoices, setInvoices] = useState<ServerInvoice[]>([]);
  const [busyTier, setBusyTier] = useState<PlanTier | null>(null);
  const [authReauthTier, setAuthReauthTier] = useState<'plus' | 'advisor' | null>(null);
  const [sandboxModal, setSandboxModal] = useState<{
    orderId?: string;
    tier: 'plus' | 'advisor';
    billingCycle: 'monthly' | 'yearly';
    currency: 'INR' | 'USD';
    amountMinor: number;
    planName: string;
  } | null>(null);

  const currentPlan = state.settings.planTier ?? 'free';

  useEffect(() => {
    if (import.meta.env.MODE === 'test' || embedded || !authSession || authSession.isDemo) return;
    let active = true;
    void fetchBillingHistory(getAuthSyncConfig()).then((res) => {
      if (active && res) setInvoices(res.invoices);
    });
    return () => {
      active = false;
    };
  }, [embedded, authSession, currentPlan, getAuthSyncConfig]);

  const baseMinor = (tier: PlanTier): number => {
    if (tier === 'free') return 0;
    if (tier === 'plus') {
      if (priceCurrency === 'INR') return 100;
      return billing === 'yearly' ? 1500 : 250;
    }
    if (priceCurrency === 'INR') return 200;
    return billing === 'yearly' ? 7900 : 800;
  };

  const priceText = (tier: PlanTier) => {
    if (tier === 'free') return priceCurrency === 'INR' ? '₹0' : '$0';
    const raw = baseMinor(tier);
    const finalMinor = appliedPromo
      ? Math.max(Math.min(raw, 100), Math.round(raw * (1 - appliedPromo.discountPct / 100)))
      : raw;
    return formatInvoiceMinorAmount(finalMinor, priceCurrency);
  };

  const handleApplyPromo = async () => {
    setPromoError('');
    const code = promoInput.trim().toUpperCase();
    if (!code) {
      setAppliedPromo(null);
      return;
    }
    if (import.meta.env.MODE !== 'test' && authSession && !authSession.isDemo) {
      const res = await validatePromoCode(getAuthSyncConfig(), {
        tier: 'advisor',
        billingCycle: billing,
        currency: priceCurrency,
        promoCode: code,
      });
      if (res?.valid && res.discountPct) {
        setAppliedPromo({ code: res.code || code, discountPct: res.discountPct });
        return;
      }
      if (res && !res.valid) {
        setAppliedPromo(null);
        setPromoError(t('price.promoInvalid'));
        return;
      }
    }
    const localPromos: Record<string, number> = { STUDENT50: 50, EARLY30: 30, FAMILY20: 20 };
    if (localPromos[code]) {
      setAppliedPromo({ code, discountPct: localPromos[code] });
    } else {
      setAppliedPromo(null);
      setPromoError(t('price.promoInvalid'));
    }
  };

  const handleChoose = async (tier: PlanTier) => {
    if (onSelectPlanAuth) {
      onSelectPlanAuth(tier);
      return;
    }
    if (
      import.meta.env.MODE !== 'test' &&
      state.settings.syncEnabled !== false &&
      tier === 'plus' &&
      !embedded &&
      authSession &&
      !authSession.isDemo
    ) {
      setBusyTier('plus');
      const trialRes = await startServerTrial(getAuthSyncConfig());
      setBusyTier(null);
      if (trialRes) {
        if (trialRes.ok) {
          upgradePlan('plus');
          await refreshSessionFromServer();
          pushToast(t('price.switchedMsg', { tier: 'PLUS' }));
          return;
        }
        if (trialRes.error === 'TRIAL_ALREADY_USED') {
          pushToast(t('price.errTrialUsed'));
          return;
        }
        if (trialRes.error === 'AUTH_REQUIRED') {
          setAuthReauthTier('plus');
          pushToast(t('price.errAuthRequired'));
          return;
        }
        if (trialRes.error !== 'D1_NOT_CONFIGURED') {
          pushToast(t('price.openPaymentFailed'));
          return;
        }
      }
    }
    upgradePlan(tier);
    pushToast(t('price.switchedMsg', { tier: tier.toUpperCase() }));
  };

  const handlePaidCheckout = useCallback(async (tier: 'plus' | 'advisor') => {
    if (onSelectPlanAuth) {
      onSelectPlanAuth(tier);
      return;
    }
    if (!authSession || authSession.isDemo) {
      upgradePlan(tier);
      return;
    }
    setAuthReauthTier(null);
    setBusyTier(tier);
    const cfg = getAuthSyncConfig();
    const res = await createBillingCheckout(cfg, {
      tier,
      billingCycle: billing,
      currency: priceCurrency,
      gstNumber: gstNumber.trim() || undefined,
      promoCode: appliedPromo?.code,
    });
    setBusyTier(null);

    if (!res || res.error || !res.checkout) {
      if (res?.error === 'BILLING_KEYS_NOT_CONFIGURED') {
        pushToast(t('price.errKeysMissing'));
      } else if (res?.error === 'D1_NOT_CONFIGURED') {
        pushToast(t('price.errDbMissing'));
      } else if (res?.error === 'AUTH_REQUIRED') {
        setAuthReauthTier(tier);
        pushToast(t('price.errAuthRequired'));
      } else {
        pushToast(t('price.openPaymentFailed'));
      }
      return;
    }

    const checkout = res.checkout;
    if (checkout.mode === 'sandbox') {
      setSandboxModal({
        orderId: checkout.orderId,
        tier,
        billingCycle: billing,
        currency: checkout.currency,
        amountMinor: checkout.amountMinor,
        planName: checkout.planName,
      });
      return;
    }

    if (checkout.provider === 'stripe' && checkout.checkoutUrl) {
      window.location.assign(checkout.checkoutUrl);
      return;
    }

    if (checkout.provider === 'razorpay' && checkout.orderId && checkout.keyId) {
      const ok = await loadRazorpayScript();
      const RazorpayCtor = (window as RazorpayWindow).Razorpay;
      if (!ok || !RazorpayCtor) {
        pushToast(t('price.openPaymentFailed'));
        return;
      }
      const rzp = new RazorpayCtor({
        key: checkout.keyId,
        amount: checkout.amountMinor,
        currency: checkout.currency,
        name: 'Dhanora (ધનોરા)',
        description: checkout.planName,
        order_id: checkout.orderId,
        prefill: { name: authSession.name, email: authSession.email },
        handler: async (rsp: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verified = await verifyRazorpayCheckout(cfg, {
            ...rsp,
            tier,
            billingCycle: billing,
            gstNumber: gstNumber.trim() || undefined,
          });
          if (verified?.ok) {
            upgradePlan(tier);
            await refreshSessionFromServer();
            const hist = await fetchBillingHistory(cfg);
            if (hist) setInvoices(hist.invoices);
            pushToast(t('price.switchedMsg', { tier: tier.toUpperCase() }));
          } else {
            pushToast(t('price.openPaymentFailed'));
          }
        },
      });
      rzp.open();
    }
  }, [
    appliedPromo?.code,
    authSession,
    billing,
    getAuthSyncConfig,
    gstNumber,
    onSelectPlanAuth,
    priceCurrency,
    pushToast,
    refreshSessionFromServer,
    t,
    upgradePlan,
  ]);

  const dispatchedPostAuthPlanRef = useRef<string | null>(null);

  useEffect(() => {
    if (embedded || !pendingPostAuthPlan || !authSession || authSession.isDemo) {
      if (!pendingPostAuthPlan) {
        dispatchedPostAuthPlanRef.current = null;
      }
      return;
    }
    const dispatchKey = `${authSession.userId}:${pendingPostAuthPlan}`;
    if (dispatchedPostAuthPlanRef.current === dispatchKey) return;
    dispatchedPostAuthPlanRef.current = dispatchKey;
    const targetTier = pendingPostAuthPlan;
    clearPendingPostAuthPlan();
    void handlePaidCheckout(targetTier);
  }, [embedded, pendingPostAuthPlan, authSession, clearPendingPostAuthPlan, handlePaidCheckout]);

  const handleGoogleReauth = (tier: 'plus' | 'advisor') => {
    const offline =
      !isOnline || (typeof navigator !== 'undefined' && navigator.onLine === false);
    if (offline) {
      pushToast(t('auth.oauthErrOffline'));
      return;
    }
    const url = buildGoogleOAuthStartUrl({
      serverUrl: state.settings.syncServerUrl,
      mode: 'signin',
      plan: tier,
    });
    try {
      window.location.assign(url);
    } catch {
      // ignore navigation errors in test environment
    }
  };

  const handleConfirmSandbox = async () => {
    if (!sandboxModal) return;
    const cfg = getAuthSyncConfig();
    const res = await completeSandboxCheckout(cfg, {
      orderId: sandboxModal.orderId,
      tier: sandboxModal.tier,
      billingCycle: sandboxModal.billingCycle,
      currency: sandboxModal.currency,
      gstNumber: gstNumber.trim() || undefined,
    });
    if (res?.ok) {
      const activatedTier = sandboxModal.tier;
      upgradePlan(activatedTier);
      await refreshSessionFromServer();
      const hist = await fetchBillingHistory(cfg);
      if (hist) setInvoices(hist.invoices);
      setSandboxModal(null);
      pushToast(t('price.switchedMsg', { tier: activatedTier.toUpperCase() }));
    } else {
      pushToast(t('price.openPaymentFailed'));
    }
  };

  const tiers: Array<{
    id: PlanTier;
    nameKey: 'price.freeName' | 'price.plusName' | 'price.advisorName';
    descKey: 'price.freeDesc' | 'price.plusDesc' | 'price.advisorDesc';
    badge?: string;
    icon: React.ComponentType<{ className?: string }>;
    features: string[];
    featured?: boolean;
  }> = [
    {
      id: 'free',
      nameKey: 'price.freeName',
      descKey: 'price.freeDesc',
      icon: Sparkles,
      features: [t('price.f1'), t('price.f2'), t('price.f3'), t('price.f4'), t('price.f5')],
    },
    {
      id: 'plus',
      nameKey: 'price.plusName',
      descKey: 'price.plusDesc',
      badge: t('price.mostPopular'),
      icon: Crown,
      featured: true,
      features: [t('price.p1'), t('price.p2'), t('price.p3'), t('price.p4'), t('price.p5')],
    },
    {
      id: 'advisor',
      nameKey: 'price.advisorName',
      descKey: 'price.advisorDesc',
      icon: Users,
      features: [t('price.a1'), t('price.a2'), t('price.a3'), t('price.a4'), t('price.a5')],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#131b2e] sm:text-[32px] sm:leading-[40px] dark:text-white">
            {t('price.title')}
          </h2>
          <p className="mt-1 text-sm text-[#404944] dark:text-[#bfc9c3]">{t('price.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-[#bfc9c3]/70 bg-white p-1 dark:border-[#2f3b52] dark:bg-[#131b2e]">
            <button
              type="button"
              onClick={() => setBilling('yearly')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                billing === 'yearly'
                  ? 'bg-[#064E3B] text-white'
                  : 'text-[#404944] dark:text-[#bfc9c3]'
              }`}
            >
              {t('price.yearlyBtn')}
            </button>
            <button
              type="button"
              onClick={() => setBilling('monthly')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                billing === 'monthly'
                  ? 'bg-[#064E3B] text-white'
                  : 'text-[#404944] dark:text-[#bfc9c3]'
              }`}
            >
              {t('price.monthlyBtn')}
            </button>
          </div>

          <div className="flex rounded-lg border border-[#bfc9c3]/70 bg-white p-1 dark:border-[#2f3b52] dark:bg-[#131b2e]">
            {(['INR', 'USD'] as const).map((cur) => (
              <button
                key={cur}
                type="button"
                onClick={() => setPriceCurrency(cur)}
                className={`font-numeric rounded-md px-2.5 py-1.5 text-xs font-bold transition ${
                  priceCurrency === cur
                    ? 'bg-[#131b2e] text-white dark:bg-[#eef0ff] dark:text-[#131b2e]'
                    : 'text-[#404944] dark:text-[#bfc9c3]'
                }`}
              >
                {cur}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!embedded && authReauthTier && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#FCD34D] bg-[#FEF3C7] px-4 py-3 text-xs font-semibold text-[#904d00]"
        >
          <div className="space-y-0.5">
            <p>{t('price.errAuthRequired')}</p>
            <p className="text-[11px] font-medium text-[#904d00]/90">
              {t('auth.reauthGooglePrompt')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleGoogleReauth(authReauthTier)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#e3dfeb] bg-[#ffffff] px-3.5 text-xs font-bold text-[#131b2e] shadow-2xs transition hover:bg-[#faf8ff]"
            >
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
              <span>{t('auth.continueWithGoogle')}</span>
            </button>
            <button
              type="button"
              onClick={() => setAuthReauthTier(null)}
              aria-label={t('auth.dismissNoticeAria')}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg hover:bg-black/5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {!embedded && (
        <div className="wdw-card flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs">
          {priceCurrency === 'INR' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[#404944] dark:text-[#bfc9c3]">
                {t('price.gstLabel')}
              </span>
              <input
                type="text"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                placeholder="24AABCU9603R1ZM"
                maxLength={15}
                className="font-numeric w-44 rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs uppercase text-[#131b2e] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-white"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[#404944] dark:text-[#bfc9c3]">
              {t('price.promoLabel')}
            </span>
            <input
              type="text"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
              placeholder={t('price.promoPlaceholder')}
              aria-label={t('price.promoLabel')}
              maxLength={24}
              className="font-numeric w-44 rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs uppercase text-[#131b2e] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-white"
            />
            <button
              type="button"
              onClick={() => void handleApplyPromo()}
              className="wdw-btn-primary px-3 py-1.5 text-xs font-semibold"
            >
              {t('price.promoApplyBtn')}
            </button>
            {appliedPromo && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#b0f0d6]/50 px-2.5 py-1 text-[11px] font-semibold text-[#064E3B] dark:bg-[#064E3B]/50 dark:text-[#b0f0d6]">
                {t('price.promoApplied', {
                  code: appliedPromo.code,
                  pct: appliedPromo.discountPct,
                })}
                <button
                  type="button"
                  onClick={() => {
                    setAppliedPromo(null);
                    setPromoInput('');
                  }}
                  className="underline"
                >
                  {t('price.promoRemove')}
                </button>
              </span>
            )}
            {promoError && (
              <span className="text-[11px] font-semibold text-[#ba1a1a]">
                {promoError}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {tiers.map((tier) => {
          const Icon = tier.icon;
          const isCurrent = !embedded && currentPlan === tier.id;
          return (
            <div
              key={tier.id}
              className={`relative flex flex-col justify-between p-6 transition ${
                tier.featured
                  ? 'wdw-card-elevated border-2 border-[#064E3B] bg-gradient-to-b from-[#b0f0d6]/25 via-white to-white dark:border-[#80bea6] dark:from-[#064E3B]/30 dark:via-[#131b2e] dark:to-[#131b2e]'
                  : 'wdw-card'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#131b2e] dark:text-white">
                    <Icon className="h-4 w-4 text-[#064E3B] dark:text-[#80bea6]" />
                    {t(tier.nameKey)}
                  </span>
                  {tier.badge && (
                    <span className="rounded-full bg-[#FEF3C7] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#904d00] ring-1 ring-[#FCD34D]">
                      {tier.badge}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-[#404944] dark:text-[#bfc9c3]">
                  {t(tier.descKey)}
                </p>

                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="font-numeric text-3xl font-bold text-[#131b2e] dark:text-white">
                    {priceText(tier.id)}
                  </span>
                  <span className="text-xs text-[#404944] dark:text-[#bfc9c3]">
                    {tier.id === 'free'
                      ? t('price.forever')
                      : billing === 'yearly'
                      ? t('price.perYear')
                      : t('price.perMonth')}
                  </span>
                </div>
                {tier.id === 'plus' && billing === 'yearly' && (
                  <p className="mt-1 text-[11px] font-semibold text-[#0F766E] dark:text-[#6ac0b6]">
                    {priceCurrency === 'INR' ? t('price.introInrNote') : t('price.introUsdNote')}
                  </p>
                )}

                <ul className="mt-5 space-y-2.5 text-xs text-[#131b2e] dark:text-[#eef0ff]">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#10B981]" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 space-y-2">
                {!(!embedded && authSession && !authSession.isDemo && tier.id === 'advisor' && !isCurrent) && (
                  <button
                    type="button"
                    disabled={isCurrent || busyTier === tier.id}
                    onClick={() => void handleChoose(tier.id)}
                    className={`w-full py-2.5 text-xs font-semibold transition ${
                      isCurrent
                        ? 'cursor-default rounded-lg border border-[#10B981]/40 bg-[#b0f0d6]/30 text-[#064E3B] dark:border-[#0F766E] dark:bg-[#064E3B]/40 dark:text-[#b0f0d6]'
                        : tier.featured
                        ? 'wdw-btn-primary'
                        : 'rounded-lg bg-[#283044] text-white hover:bg-[#131b2e] dark:bg-[#eef0ff] dark:text-[#131b2e] dark:hover:bg-white'
                    }`}
                  >
                    {isCurrent
                      ? t('price.activePlanBadge')
                      : tier.id === 'plus'
                      ? t('price.startTrialCta')
                      : tier.id === 'advisor'
                      ? t('price.chooseAdvisorCta')
                      : t('price.chooseFreeCta')}
                  </button>
                )}

                {!embedded && authSession && !authSession.isDemo && tier.id !== 'free' && !isCurrent && (
                  <button
                    type="button"
                    disabled={busyTier === tier.id}
                    onClick={() => void handlePaidCheckout(tier.id as 'plus' | 'advisor')}
                    className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold transition disabled:opacity-60 ${
                      tier.id === 'advisor'
                        ? 'wdw-btn-primary'
                        : 'wdw-btn-secondary'
                    }`}
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    {t('price.checkoutPayBtn')} ({priceText(tier.id)})
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Billing History & GST Invoices */}
      {!embedded && authSession && !authSession.isDemo && (
        <div className="wdw-card p-6">
          <div className="mb-3 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-[#064E3B] dark:text-[#b0f0d6]" />
            <h3 className="text-sm font-semibold text-[#131b2e] dark:text-white">
              {t('price.invoicesHeading')}
            </h3>
          </div>
          {invoices.length === 0 ? (
            <p className="text-xs text-[#404944] dark:text-[#bfc9c3]">{t('price.noInvoices')}</p>
          ) : (
            <div className="divide-y divide-[#F1F5F9] text-xs dark:divide-[#232f4f]">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div>
                    <span className="font-semibold uppercase text-[#131b2e] dark:text-white">
                      {inv.planTier} ({inv.billingCycle})
                    </span>
                    <div className="font-numeric text-[11px] text-[#404944] dark:text-[#bfc9c3]">
                      {inv.createdAt.slice(0, 10)} • {inv.provider}
                      {inv.gstNumber ? ` • GSTIN ${inv.gstNumber}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-numeric font-bold text-[#131b2e] dark:text-white">
                      {formatInvoiceMinorAmount(inv.amountMinor, inv.currency)}
                    </span>
                    <span className="rounded-full bg-[#b0f0d6]/50 px-2 py-0.5 text-[10px] font-bold uppercase text-[#064E3B] dark:bg-[#064E3B]/50 dark:text-[#b0f0d6]">
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sandbox Interactive Payment Confirmation Modal */}
      {sandboxModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#131b2e]/60 p-4 backdrop-blur-xs"
        >
          <div className="wdw-card-elevated w-full max-w-md rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#131b2e] dark:text-white">
                {sandboxModal.planName} ({sandboxModal.billingCycle})
              </span>
              <button
                type="button"
                onClick={() => setSandboxModal(null)}
                className="rounded-lg p-1 text-[#707974] hover:text-[#131b2e]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 rounded-xl border border-[#FCD34D] bg-[#FEF3C7] p-3 text-xs text-[#904d00]">
              {t('price.sandboxBadge')}
            </div>
            <div className="mt-4 flex items-baseline justify-between text-xs">
              <span className="font-numeric text-[#404944] dark:text-[#bfc9c3]">Order {sandboxModal.orderId}</span>
              <span className="font-numeric text-xl font-bold text-[#131b2e] dark:text-white">
                {formatInvoiceMinorAmount(sandboxModal.amountMinor, sandboxModal.currency)}
              </span>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => void handleConfirmSandbox()}
                className="wdw-btn-primary flex-1 py-2.5 text-xs font-semibold"
              >
                {t('price.sandboxConfirmBtn')}
              </button>
              <button
                type="button"
                onClick={() => setSandboxModal(null)}
                className="rounded-lg border border-[#CBD5E1] px-4 py-2.5 text-xs font-semibold text-[#404944] dark:border-[#2f3b52] dark:text-[#bfc9c3]"
              >
                {t('price.cancelCheckoutBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison Matrix */}
      <div className="wdw-card overflow-hidden">
        <div className="border-b border-[#F1F5F9] px-5 py-3.5 dark:border-[#232f4f]">
          <h3 className="text-sm font-semibold text-[#131b2e] dark:text-white">
            {t('price.matrixTitle')}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead>
              <tr className="label-caps border-b border-[#F1F5F9] bg-[#f2f3ff] text-[#404944] dark:border-[#232f4f] dark:bg-[#172036] dark:text-[#bfc9c3]">
                <th className="px-5 py-3">{t('price.colFeature')}</th>
                <th className="px-4 py-3 text-center">{t('price.freeName')}</th>
                <th className="px-4 py-3 text-center text-[#064E3B] dark:text-[#b0f0d6]">
                  {t('price.plusName')}
                </th>
                <th className="px-4 py-3 text-center">{t('price.advisorName')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#232f4f]">
              {[
                { label: t('price.rowTx'), free: t('price.unlimited'), plus: t('price.unlimited'), adv: t('price.unlimited') },
                { label: t('price.rowGoals'), free: t('price.upTo3Goals'), plus: t('price.unlimited'), adv: t('price.unlimited') },
                { label: t('price.rowMembers'), free: t('price.upTo4Members'), plus: t('price.unlimited'), adv: t('price.unlimited') },
                { label: t('price.rowCalcs'), free: t('price.included'), plus: t('price.included'), adv: t('price.included') },
                { label: t('price.rowVault'), free: '—', plus: t('price.included'), adv: t('price.included') },
                { label: t('price.rowDebt'), free: '—', plus: t('price.included'), adv: t('price.included') },
                { label: t('price.rowAdvisor'), free: t('price.ownerOnly'), plus: t('price.ownerOnly'), adv: t('price.isolatedAdvisor') },
              ].map((row) => (
                <tr key={row.label} className="hover:bg-[#f2f3ff]/60 dark:hover:bg-[#1c2640]/40">
                  <td className="px-5 py-3 font-semibold text-[#131b2e] dark:text-[#eef0ff]">
                    {row.label}
                  </td>
                  <td className="px-4 py-3 text-center text-[#404944] dark:text-[#bfc9c3]">
                    {row.free}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-[#064E3B] dark:text-[#b0f0d6]">
                    {row.plus}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-[#131b2e] dark:text-[#eef0ff]">
                    {row.adv}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="wdw-surface-tier flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-3.5 text-xs text-[#404944] dark:text-[#bfc9c3]">
        <span className="inline-flex items-center gap-2 font-semibold text-[#131b2e] dark:text-white">
          <ShieldCheck className="h-4 w-4 text-[#064E3B] dark:text-[#80bea6]" />
          {t('price.guaranteeLine')}
        </span>
        <span className="font-medium">{t('price.razorpayBadge')}</span>
        <span>{t('price.noAutoRenewNote')}</span>
      </div>
    </div>
  );
};
