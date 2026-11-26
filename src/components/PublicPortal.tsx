import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Flame,
  Landmark,
  Lock,
  Moon,
  PiggyBank,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import type { PlanTier, PublicLegalPage } from '../types/finance';
import { CalculatorsFireView } from '../pages/CalculatorsFireView';
import { PricingView } from '../pages/PricingView';
import { LegalPagesView } from '../pages/LegalPagesView';
import { AuthPages, type AuthScreenMode } from './AuthPages';
import { LanguageToggle } from './LanguageToggle';
import { useI18n } from '../i18n/useI18n';

function resolveInitialPublicRoute(): {
  route: 'landing' | 'auth' | 'legal';
  authMode: AuthScreenMode;
  legalPage: PublicLegalPage;
  inviteCode?: string;
} {
  if (typeof window === 'undefined') {
    return { route: 'landing', authMode: 'signin', legalPage: 'privacy' };
  }
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const inviteCode = params.get('code') || params.get('invite') || undefined;
  if (path === '/signin') return { route: 'auth', authMode: 'signin', legalPage: 'privacy' };
  if (path === '/signup' || path === '/invite' || inviteCode) {
    return { route: 'auth', authMode: 'signup', legalPage: 'privacy', inviteCode };
  }
  if (path === '/privacy') return { route: 'legal', authMode: 'signin', legalPage: 'privacy' };
  if (path === '/terms') return { route: 'legal', authMode: 'signin', legalPage: 'terms' };
  if (path === '/refund-policy') {
    return { route: 'legal', authMode: 'signin', legalPage: 'refund-policy' };
  }
  if (path === '/contact') return { route: 'legal', authMode: 'signin', legalPage: 'contact' };
  return { route: 'landing', authMode: 'signin', legalPage: 'privacy' };
}

function syncBrowserPath(nextPath: string) {
  try {
    if (typeof window !== 'undefined' && window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
  } catch {
    // ignore in restricted environments
  }
}

export const PublicPortal: React.FC = () => {
  const { state, enterGuestDemo, updateSettings, canInstallPwa, triggerInstallPwa } = useFinance();
  const { t } = useI18n();
  const isDark = state.settings.theme === 'dark';

  const initial = resolveInitialPublicRoute();
  const [route, setRoute] = useState<'landing' | 'auth' | 'legal'>(initial.route);
  const [authMode, setAuthMode] = useState<AuthScreenMode>(initial.authMode);
  const [legalPage, setLegalPage] = useState<PublicLegalPage>(initial.legalPage);
  const [initialInviteCode] = useState<string | undefined>(initial.inviteCode);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>('free');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    const onPop = () => {
      const next = resolveInitialPublicRoute();
      setRoute(next.route);
      setAuthMode(next.authMode);
      setLegalPage(next.legalPage);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const openAuth = (mode: AuthScreenMode, plan: PlanTier = 'free') => {
    setAuthMode(mode);
    setSelectedPlan(plan);
    setRoute('auth');
    syncBrowserPath(mode === 'signup' ? '/signup' : '/signin');
  };

  const openLegal = (page: PublicLegalPage) => {
    setLegalPage(page);
    setRoute('legal');
    syncBrowserPath(`/${page}`);
  };

  const backHome = () => {
    setRoute('landing');
    syncBrowserPath('/');
  };

  if (route === 'auth') {
    return (
      <AuthPages
        initialMode={authMode}
        initialPlan={selectedPlan}
        initialInviteCode={initialInviteCode}
        onBackHome={backHome}
      />
    );
  }

  if (route === 'legal') {
    return (
      <LegalPagesView
        activePage={legalPage}
        onSelectPage={openLegal}
        onBackHome={backHome}
      />
    );
  }

  const modules = [
    {
      icon: TrendingUp,
      color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
      title: t('pub.mod1Title'),
      desc: t('pub.mod1Desc'),
    },
    {
      icon: PiggyBank,
      color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400',
      title: t('pub.mod2Title'),
      desc: t('pub.mod2Desc'),
    },
    {
      icon: Landmark,
      color: 'bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400',
      title: t('pub.mod3Title'),
      desc: t('pub.mod3Desc'),
    },
    {
      icon: Target,
      color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
      title: t('pub.mod4Title'),
      desc: t('pub.mod4Desc'),
    },
    {
      icon: Flame,
      color: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
      title: t('pub.mod5Title'),
      desc: t('pub.mod5Desc'),
    },
    {
      icon: ShieldCheck,
      color: 'bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400',
      title: t('pub.mod6Title'),
      desc: t('pub.mod6Desc'),
    },
    {
      icon: CalendarClock,
      color: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
      title: t('pub.mod7Title'),
      desc: t('pub.mod7Desc'),
    },
  ];

  const faqs = [
    { q: t('pub.faq1Q'), a: t('pub.faq1A') },
    { q: t('pub.faq2Q'), a: t('pub.faq2A') },
    { q: t('pub.faq3Q'), a: t('pub.faq3A') },
    { q: t('pub.faq4Q'), a: t('pub.faq4A') },
    { q: t('pub.faq5Q'), a: t('pub.faq5A') },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Top Marketing Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 text-lg text-white shadow-sm">
              🏡
            </div>
            <div>
              <div className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">
                {t('brand.name')}
              </div>
              <div className="hidden text-[10px] font-semibold text-emerald-600 sm:block dark:text-emerald-400">
                {t('pub.brandTagline')}
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-5 text-xs font-semibold text-slate-600 md:flex dark:text-slate-300">
            <a href="#features" className="hover:text-emerald-600">
              {t('pub.navFeatures')}
            </a>
            <a href="#calculators" className="hover:text-emerald-600">
              {t('pub.navCalculators')}
            </a>
            <a href="#pricing" className="hover:text-emerald-600">
              {t('pub.navPricing')}
            </a>
            <a href="#faq" className="hover:text-emerald-600">
              {t('pub.navFaq')}
            </a>
          </nav>

          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            <LanguageToggle />
            <button
              type="button"
              onClick={() => updateSettings({ theme: isDark ? 'light' : 'dark' })}
              className="rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
              aria-label={t('a11y.darkToggle')}
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => openAuth('signin')}
              className="whitespace-nowrap rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50 sm:px-3 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {t('pub.signInBtn')}
            </button>
            <button
              type="button"
              onClick={() => openAuth('signup')}
              className="whitespace-nowrap rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 sm:px-3.5"
            >
              {t('pub.createAccountBtn')}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-16 px-4 py-12 sm:px-6">
        {/* Hero */}
        <section className="rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-12">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              {t('pub.heroBadge')}
            </span>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
              {t('pub.heroTitle')}
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
              {t('pub.heroSub')}
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => openAuth('signup', 'plus')}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
              >
                <span>{t('pub.ctaStartFree')}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => enterGuestDemo(0)}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-5 py-3 text-sm font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <Users className="h-4 w-4" />
                <span>{t('pub.ctaSampleFamily')}</span>
              </button>
              <a
                href="#calculators"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <BarChart3 className="h-4 w-4" />
                <span>{t('pub.ctaCalculators')}</span>
              </a>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-emerald-600" />
                {t('pub.trust1')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-emerald-600" />
                {t('pub.trust2')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                {t('pub.trust3')}
              </span>
            </div>
          </div>
        </section>

        {/* 7 Color-Coded Modules */}
        <section id="features" className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {t('pub.modulesTitle')}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('pub.modulesSub')}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((mod) => {
              const Icon = mod.icon;
              return (
                <div
                  key={mod.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
                >
                  <div
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${mod.color}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                    {mod.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {mod.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Interactive Calculators Showcase */}
        <section id="calculators" className="space-y-4">
          <div className="text-center">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {t('pub.calcsTitle')}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('pub.calcsSub')}</p>
          </div>
          <CalculatorsFireView initialTab="tax" embedded />
        </section>

        {/* Commercial Pricing */}
        <section id="pricing">
          <PricingView
            embedded
            onSelectPlanAuth={(tier) => openAuth('signup', tier)}
          />
        </section>

        {/* FAQ Accordion */}
        <section id="faq" className="space-y-4">
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {t('pub.faqTitle')}
          </h2>
          <div className="mx-auto max-w-3xl space-y-2.5">
            {faqs.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={item.q}
                  className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-bold text-slate-900 dark:text-white"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-400 transition ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-slate-100 px-5 py-3 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-300">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          <div>
            <span className="font-bold text-slate-800 dark:text-slate-200">{t('brand.name')}</span>{' '}
            — {t('pub.footerDisclaimer')}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {canInstallPwa && (
              <button
                type="button"
                onClick={() => void triggerInstallPwa()}
                className="font-semibold text-emerald-600 hover:underline"
              >
                {t('layout.installApp')}
              </button>
            )}
            <button
              type="button"
              onClick={() => openLegal('privacy')}
              className="font-semibold hover:text-emerald-600"
            >
              {t('legal.navPrivacy')}
            </button>
            <button
              type="button"
              onClick={() => openLegal('terms')}
              className="font-semibold hover:text-emerald-600"
            >
              {t('legal.navTerms')}
            </button>
            <button
              type="button"
              onClick={() => openLegal('refund-policy')}
              className="font-semibold hover:text-emerald-600"
            >
              {t('legal.navRefund')}
            </button>
            <button
              type="button"
              onClick={() => openLegal('contact')}
              className="font-semibold hover:text-emerald-600"
            >
              {t('legal.navContact')}
            </button>
            <button
              type="button"
              onClick={() => openAuth('signin')}
              className="font-semibold hover:text-emerald-600"
            >
              {t('pub.signInBtn')}
            </button>
            <button
              type="button"
              onClick={() => enterGuestDemo(3)}
              className="font-semibold hover:text-emerald-600"
            >
              {t('pub.tryAdvisorDemo')}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
