import React, { useEffect, useState } from 'react';
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
  completeSandboxCheckout,
  createBillingCheckout,
  fetchBillingHistory,
  startServerTrial,
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
    getAuthSyncConfig,
    upgradePlan,
    refreshSessionFromServer,
    pushToast,
  } = useFinance();
  const { t } = useI18n();
  const [billing, setBilling] = useState<'yearly' | 'monthly'>('yearly');
  const [priceCurrency, setPriceCurrency] = useState<'INR' | 'USD'>(
    state.settings.baseCurrency === 'USD' && !embedded ? 'USD' : 'INR'
  );
  const [gstNumber, setGstNumber] = useState('');
  const [invoices, setInvoices] = useState<ServerInvoice[]>([]);
  const [busyTier, setBusyTier] = useState<PlanTier | null>(null);
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

  const priceText = (tier: PlanTier) => {
    if (tier === 'free') return priceCurrency === 'INR' ? '₹0' : '$0';
    if (tier === 'plus') {
      if (billing === 'yearly') return priceCurrency === 'INR' ? '₹799' : '$15';
      return priceCurrency === 'INR' ? '₹149' : '$2.50';
    }
    if (billing === 'yearly') return priceCurrency === 'INR' ? '₹4,999' : '$79';
    return priceCurrency === 'INR' ? '₹499' : '$8';
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

  const handlePaidCheckout = async (tier: 'plus' | 'advisor') => {
    if (onSelectPlanAuth) {
      onSelectPlanAuth(tier);
      return;
    }
    if (!authSession || authSession.isDemo) {
      upgradePlan(tier);
      return;
    }
    setBusyTier(tier);
    const cfg = getAuthSyncConfig();
    const res = await createBillingCheckout(cfg, {
      tier,
      billingCycle: billing,
      currency: priceCurrency,
      gstNumber: gstNumber.trim() || undefined,
    });
    setBusyTier(null);

    if (!res || res.error || !res.checkout) {
      if (res?.error === 'BILLING_KEYS_NOT_CONFIGURED') {
        pushToast(t('price.errKeysMissing'));
      } else if (res?.error === 'D1_NOT_CONFIGURED') {
        pushToast(t('price.errDbMissing'));
      } else if (res?.error === 'AUTH_REQUIRED') {
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
        name: 'HearthLedger',
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
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {t('price.title')}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('price.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setBilling('yearly')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                billing === 'yearly'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {t('price.yearlyBtn')}
            </button>
            <button
              type="button"
              onClick={() => setBilling('monthly')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                billing === 'monthly'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {t('price.monthlyBtn')}
            </button>
          </div>

          <div className="flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
            {(['INR', 'USD'] as const).map((cur) => (
              <button
                key={cur}
                type="button"
                onClick={() => setPriceCurrency(cur)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                  priceCurrency === cur
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {cur}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!embedded && priceCurrency === 'INR' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="font-semibold text-slate-600 dark:text-slate-300">
            {t('price.gstLabel')}
          </span>
          <input
            type="text"
            value={gstNumber}
            onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
            placeholder="24AABCU9603R1ZM"
            maxLength={15}
            className="w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-xs uppercase dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {tiers.map((tier) => {
          const Icon = tier.icon;
          const isCurrent = !embedded && currentPlan === tier.id;
          return (
            <div
              key={tier.id}
              className={`relative flex flex-col justify-between rounded-2xl border p-6 shadow-xs transition ${
                tier.featured
                  ? 'border-emerald-500 bg-gradient-to-b from-emerald-50/60 to-white shadow-md dark:border-emerald-700 dark:from-emerald-950/30 dark:to-slate-900'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-slate-900 dark:text-white">
                    <Icon className="h-4 w-4 text-emerald-600" />
                    {t(tier.nameKey)}
                  </span>
                  {tier.badge && (
                    <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white">
                      {tier.badge}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  {t(tier.descKey)}
                </p>

                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                    {priceText(tier.id)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {tier.id === 'free'
                      ? t('price.forever')
                      : billing === 'yearly'
                      ? t('price.perYear')
                      : t('price.perMonth')}
                  </span>
                </div>
                {tier.id === 'plus' && billing === 'yearly' && (
                  <p className="mt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    {priceCurrency === 'INR' ? t('price.introInrNote') : t('price.introUsdNote')}
                  </p>
                )}

                <ul className="mt-5 space-y-2.5 text-xs text-slate-700 dark:text-slate-200">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
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
                    className={`w-full rounded-xl py-2.5 text-xs font-bold transition ${
                      isCurrent
                        ? 'cursor-default border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : tier.featured
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white'
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
                    className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition disabled:opacity-60 ${
                      tier.id === 'advisor'
                        ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white'
                        : 'border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-800 dark:text-emerald-300'
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('price.invoicesHeading')}
            </h3>
          </div>
          {invoices.length === 0 ? (
            <p className="text-xs text-slate-500">{t('price.noInvoices')}</p>
          ) : (
            <div className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div>
                    <span className="font-bold uppercase text-slate-900 dark:text-white">
                      {inv.planTier} ({inv.billingCycle})
                    </span>
                    <div className="text-[11px] text-slate-500">
                      {inv.createdAt.slice(0, 10)} • {inv.provider}
                      {inv.gstNumber ? ` • GSTIN ${inv.gstNumber}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {formatInvoiceMinorAmount(inv.amountMinor, inv.currency)}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                {sandboxModal.planName} ({sandboxModal.billingCycle})
              </span>
              <button
                type="button"
                onClick={() => setSandboxModal(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {t('price.sandboxBadge')}
            </div>
            <div className="mt-4 flex items-baseline justify-between text-xs">
              <span className="text-slate-500">Order {sandboxModal.orderId}</span>
              <span className="text-xl font-extrabold text-slate-900 dark:text-white">
                {formatInvoiceMinorAmount(sandboxModal.amountMinor, sandboxModal.currency)}
              </span>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => void handleConfirmSandbox()}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
              >
                {t('price.sandboxConfirmBtn')}
              </button>
              <button
                type="button"
                onClick={() => setSandboxModal(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
              >
                {t('price.cancelCheckoutBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
        <span className="inline-flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          {t('price.guaranteeLine')}
        </span>
        <span>{t('price.noAutoRenewNote')}</span>
      </div>
    </div>
  );
};
