import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Flame,
  Globe,
  HeartHandshake,
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
import { HeroProductPreview } from './HeroProductPreview';
import { BrandMark } from './BrandMark';
import { LanguageToggle } from './LanguageToggle';
import { useI18n } from '../i18n/useI18n';

function resolveInitialPublicRoute(): {
  route: 'landing' | 'auth' | 'legal';
  authMode: AuthScreenMode;
  legalPage: PublicLegalPage;
  inviteCode?: string;
  resetToken?: string;
  scrollSection?: 'pricing' | 'calculators';
} {
  if (typeof window === 'undefined') {
    return { route: 'landing', authMode: 'signin', legalPage: 'privacy' };
  }
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const inviteCode = params.get('code') || params.get('invite') || undefined;
  const resetToken =
    params.get('resetToken') || (path === '/reset-password' ? params.get('token') || '' : undefined);
  if (path === '/reset-password' || resetToken) {
    return {
      route: 'auth',
      authMode: 'reset',
      legalPage: 'privacy',
      resetToken: resetToken || undefined,
    };
  }
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
  if (path === '/pricing') {
    return { route: 'landing', authMode: 'signin', legalPage: 'privacy', scrollSection: 'pricing' };
  }
  if (path === '/calculators') {
    return {
      route: 'landing',
      authMode: 'signin',
      legalPage: 'privacy',
      scrollSection: 'calculators',
    };
  }
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
  const [initialResetToken] = useState<string | undefined>(initial.resetToken);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>('free');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    if (initial.scrollSection && typeof document !== 'undefined') {
      const target = document.getElementById(initial.scrollSection);
      target?.scrollIntoView?.({ behavior: 'smooth' });
    }
  }, [initial.scrollSection]);

  useEffect(() => {
    const onPop = () => {
      const next = resolveInitialPublicRoute();
      setRoute(next.route);
      setAuthMode(next.authMode);
      setLegalPage(next.legalPage);
      if (next.scrollSection && typeof document !== 'undefined') {
        setTimeout(() => {
          document.getElementById(next.scrollSection!)?.scrollIntoView?.({ behavior: 'smooth' });
        }, 50);
      }
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
        initialResetToken={initialResetToken}
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
      color: 'bg-[#064E3B]/10 text-[#064E3B] dark:bg-[#064E3B]/40 dark:text-[#b0f0d6]',
      title: t('pub.mod1Title'),
      desc: t('pub.mod1Desc'),
    },
    {
      icon: PiggyBank,
      color: 'bg-[#FEF3C7] text-[#904d00] dark:bg-[#904d00]/40 dark:text-[#ffdcc3]',
      title: t('pub.mod2Title'),
      desc: t('pub.mod2Desc'),
    },
    {
      icon: Landmark,
      color: 'bg-[#0F766E]/10 text-[#0F766E] dark:bg-[#004d47]/50 dark:text-[#9cf2e8]',
      title: t('pub.mod3Title'),
      desc: t('pub.mod3Desc'),
    },
    {
      icon: Target,
      color: 'bg-[#FEF3C7] text-[#D97706] dark:bg-[#904d00]/40 dark:text-[#ffb77d]',
      title: t('pub.mod4Title'),
      desc: t('pub.mod4Desc'),
    },
    {
      icon: Flame,
      color: 'bg-[#10B981]/12 text-[#064E3B] dark:bg-[#10B981]/20 dark:text-[#95d3ba]',
      title: t('pub.mod5Title'),
      desc: t('pub.mod5Desc'),
    },
    {
      icon: ShieldCheck,
      color: 'bg-[#004d47]/10 text-[#004d47] dark:bg-[#004d47]/50 dark:text-[#80d5cb]',
      title: t('pub.mod6Title'),
      desc: t('pub.mod6Desc'),
    },
    {
      icon: CalendarClock,
      color: 'bg-[#eaedff] text-[#131b2e] dark:bg-[#232f4f] dark:text-[#eef0ff]',
      title: t('pub.mod7Title'),
      desc: t('pub.mod7Desc'),
    },
  ];

  const personas = [
    {
      icon: HeartHandshake,
      color: 'bg-[#064E3B]/10 text-[#064E3B] dark:bg-[#064E3B]/40 dark:text-[#b0f0d6]',
      title: t('pub.persona1Title'),
      desc: t('pub.persona1Desc'),
    },
    {
      icon: Users,
      color: 'bg-[#0F766E]/10 text-[#0F766E] dark:bg-[#004d47]/50 dark:text-[#9cf2e8]',
      title: t('pub.persona2Title'),
      desc: t('pub.persona2Desc'),
    },
    {
      icon: Globe,
      color: 'bg-[#FEF3C7] text-[#904d00] dark:bg-[#904d00]/40 dark:text-[#ffdcc3]',
      title: t('pub.persona3Title'),
      desc: t('pub.persona3Desc'),
    },
    {
      icon: Briefcase,
      color: 'bg-[#eaedff] text-[#003430] dark:bg-[#232f4f] dark:text-[#80d5cb]',
      title: t('pub.persona4Title'),
      desc: t('pub.persona4Desc'),
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
    <div className="min-h-screen bg-[#faf8ff] text-[#131b2e] dark:bg-[#0b1120] dark:text-[#eef0ff]">
      {/* Top Marketing Navbar */}
      <header className="sticky top-0 z-40 border-b border-[#bfc9c3]/40 bg-[#faf8ff]/90 backdrop-blur-md dark:border-[#232f4f] dark:bg-[#0b1120]/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <div className="flex items-center gap-2.5">
            <BrandMark size="md" />
            <div>
              <div className="text-sm font-bold tracking-tight text-[#131b2e] dark:text-white">
                {t('brand.name')}
              </div>
              <div className="hidden text-[11px] font-medium text-[#0F766E] sm:block dark:text-[#80bea6]">
                {t('pub.brandTagline')}
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-xs font-semibold text-[#404944] md:flex dark:text-[#bfc9c3]">
            <a href="#features" className="transition hover:text-[#064E3B] dark:hover:text-[#b0f0d6]">
              {t('pub.navFeatures')}
            </a>
            <a href="#calculators" className="transition hover:text-[#064E3B] dark:hover:text-[#b0f0d6]">
              {t('pub.navCalculators')}
            </a>
            <a href="#pricing" className="transition hover:text-[#064E3B] dark:hover:text-[#b0f0d6]">
              {t('pub.navPricing')}
            </a>
            <a href="#faq" className="transition hover:text-[#064E3B] dark:hover:text-[#b0f0d6]">
              {t('pub.navFaq')}
            </a>
          </nav>

          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            <LanguageToggle />
            <button
              type="button"
              onClick={() => updateSettings({ theme: isDark ? 'light' : 'dark' })}
              className="rounded-lg border border-[#bfc9c3]/70 bg-white p-2 text-[#404944] hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:bg-[#131b2e] dark:text-[#eef0ff] dark:hover:bg-[#1c2640]"
              aria-label={t('a11y.darkToggle')}
            >
              {isDark ? <Sun className="h-4 w-4 text-[#fe932c]" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => openAuth('signin')}
              className="whitespace-nowrap rounded-lg border border-[#bfc9c3] bg-white px-3 py-2 text-xs font-semibold text-[#131b2e] hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:bg-[#131b2e] dark:text-[#eef0ff]"
            >
              {t('pub.signInBtn')}
            </button>
            <button
              type="button"
              onClick={() => openAuth('signup')}
              className="wdw-btn-primary whitespace-nowrap px-3.5 py-2 text-xs font-semibold shadow-xs"
            >
              {t('pub.createAccountBtn')}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-16 px-4 py-10 sm:px-6 lg:px-10 sm:py-12">
        {/* Split Hero + Interactive 3-Tab Live App Preview */}
        <section className="wdw-card-elevated bg-mesh-hero rounded-3xl p-6 sm:p-10">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEF3C7] px-3.5 py-1 text-xs font-semibold text-[#904d00] ring-1 ring-[#FCD34D]/80 dark:bg-[#904d00]/40 dark:text-[#ffdcc3] dark:ring-[#fe932c]/30">
                <Sparkles className="h-3.5 w-3.5 text-[#D97706]" />
                {t('pub.heroBadge')}
              </span>
              <h1 className="font-display mt-4 text-[34px] leading-[42px] font-bold tracking-[-0.015em] text-[#131b2e] sm:text-[48px] sm:leading-[56px] sm:tracking-[-0.02em] dark:text-white">
                {t('pub.heroTitle')}
              </h1>
              <p className="mt-4 text-[15px] leading-[24px] text-[#404944] sm:text-[18px] sm:leading-[28px] dark:text-[#bfc9c3]">
                {t('pub.heroSub')}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => openAuth('signup', 'plus')}
                  className="wdw-btn-primary inline-flex min-h-[44px] items-center gap-2 px-5 py-3 text-sm font-semibold shadow-sm"
                >
                  <span>{t('pub.ctaStartFree')}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => enterGuestDemo(0)}
                  className="wdw-btn-secondary inline-flex min-h-[44px] items-center gap-2 px-4 py-3 text-sm font-semibold"
                >
                  <Users className="h-4 w-4" />
                  <span>{t('pub.ctaSampleFamily')}</span>
                </button>
                <a
                  href="#calculators"
                  className="wdw-btn-ghost inline-flex min-h-[44px] items-center gap-2 border border-[#bfc9c3]/70 bg-white/85 px-4 py-3 text-xs font-semibold hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:bg-[#131b2e] dark:text-[#80d5cb]"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>{t('pub.ctaCalculators')}</span>
                </a>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-[#404944] dark:text-[#bfc9c3]">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-[#064E3B] dark:text-[#80bea6]" />
                  {t('pub.trust1')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-[#0F766E] dark:text-[#6ac0b6]" />
                  {t('pub.trust2')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#10B981]" />
                  {t('pub.trust3')}
                </span>
              </div>
            </div>

            <div className="lg:col-span-6">
              <HeroProductPreview />
            </div>
          </div>
        </section>

        {/* Household Persona Bento Grid */}
        <section className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-[#131b2e] sm:text-[32px] sm:leading-[40px] dark:text-white">
              {t('pub.personasTitle')}
            </h2>
            <p className="mt-1.5 text-[15px] text-[#404944] dark:text-[#bfc9c3]">{t('pub.personasSub')}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {personas.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="wdw-card p-6 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${item.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3.5 text-sm font-semibold text-[#131b2e] dark:text-white">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-[20px] text-[#404944] dark:text-[#bfc9c3]">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 7 Color-Coded Modules */}
        <section id="features" className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-[#131b2e] sm:text-[32px] sm:leading-[40px] dark:text-white">
              {t('pub.modulesTitle')}
            </h2>
            <p className="mt-1.5 text-[15px] text-[#404944] dark:text-[#bfc9c3]">{t('pub.modulesSub')}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((mod) => {
              const Icon = mod.icon;
              return (
                <div
                  key={mod.title}
                  className="wdw-card p-6 transition hover:border-[#0F766E]/30 hover:shadow-md"
                >
                  <div
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${mod.color}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3.5 text-sm font-semibold text-[#131b2e] dark:text-white">
                    {mod.title}
                  </h3>
                  <p className="mt-1 text-[13px] leading-[20px] text-[#404944] dark:text-[#bfc9c3]">
                    {mod.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Security & Ownership Strip */}
        <section className="wdw-hero-vault p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold text-[#b0f0d6]">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t('brand.name')} Security
              </div>
              <h2 className="mt-2.5 text-xl font-bold tracking-tight text-white sm:text-2xl">
                {t('pub.secBannerTitle')}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => openAuth('signup')}
              className="rounded-lg bg-[#FEF3C7] px-4 py-2.5 text-xs font-bold text-[#904d00] shadow-xs transition hover:bg-[#fde68a]"
            >
              {t('pub.ctaStartFree')}
            </button>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            {[t('pub.sec1'), t('pub.sec2'), t('pub.sec3')].map((line) => (
              <div
                key={line}
                className="flex items-start gap-2.5 rounded-xl border border-white/15 bg-white/8 p-3.5 text-xs text-[#b0f0d6]"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#10B981]" />
                <span className="text-white/95">{line}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Interactive Calculators Showcase */}
        <section id="calculators" className="space-y-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-[#131b2e] sm:text-[32px] sm:leading-[40px] dark:text-white">
              {t('pub.calcsTitle')}
            </h2>
            <p className="mt-1 text-[15px] text-[#404944] dark:text-[#bfc9c3]">{t('pub.calcsSub')}</p>
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
          <h2 className="text-center text-2xl font-bold tracking-tight text-[#131b2e] sm:text-[32px] dark:text-white">
            {t('pub.faqTitle')}
          </h2>
          <div className="mx-auto max-w-3xl space-y-2.5">
            {faqs.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={item.q}
                  className="wdw-card overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-[#131b2e] dark:text-white"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-[#404944] transition ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-[#F1F5F9] px-5 py-3.5 text-[13px] leading-relaxed text-[#404944] dark:border-[#232f4f] dark:text-[#bfc9c3]">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#bfc9c3]/40 bg-[#f2f3ff]/80 py-8 text-xs text-[#404944] dark:border-[#232f4f] dark:bg-[#131b2e] dark:text-[#bfc9c3]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
          <div className="flex items-center gap-2">
            <BrandMark size="sm" />
            <span>
              <span className="font-bold text-[#131b2e] dark:text-white">{t('brand.name')}</span>{' '}
              — {t('pub.footerDisclaimer')}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {canInstallPwa && (
              <button
                type="button"
                onClick={() => void triggerInstallPwa()}
                className="font-semibold text-[#064E3B] hover:underline dark:text-[#80bea6]"
              >
                {t('layout.installApp')}
              </button>
            )}
            <button
              type="button"
              onClick={() => openLegal('privacy')}
              className="font-semibold hover:text-[#064E3B] dark:hover:text-[#b0f0d6]"
            >
              {t('legal.navPrivacy')}
            </button>
            <button
              type="button"
              onClick={() => openLegal('terms')}
              className="font-semibold hover:text-[#064E3B] dark:hover:text-[#b0f0d6]"
            >
              {t('legal.navTerms')}
            </button>
            <button
              type="button"
              onClick={() => openLegal('refund-policy')}
              className="font-semibold hover:text-[#064E3B] dark:hover:text-[#b0f0d6]"
            >
              {t('legal.navRefund')}
            </button>
            <button
              type="button"
              onClick={() => openLegal('contact')}
              className="font-semibold hover:text-[#064E3B] dark:hover:text-[#b0f0d6]"
            >
              {t('legal.navContact')}
            </button>
            <button
              type="button"
              onClick={() => openAuth('signin')}
              className="font-semibold hover:text-[#064E3B] dark:hover:text-[#b0f0d6]"
            >
              {t('pub.signInBtn')}
            </button>
            <button
              type="button"
              onClick={() => enterGuestDemo(3)}
              className="font-semibold hover:text-[#064E3B] dark:hover:text-[#b0f0d6]"
            >
              {t('pub.tryAdvisorDemo')}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
