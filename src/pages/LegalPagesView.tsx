import React from 'react';
import { ArrowLeft, FileCheck2, HelpCircle, Lock, RefreshCw } from 'lucide-react';
import type { PublicLegalPage } from '../types/finance';
import { LanguageToggle } from '../components/LanguageToggle';
import { BrandLogoButton } from '../components/BrandMark';
import { useI18n } from '../i18n/useI18n';

export const LegalPagesView: React.FC<{
  activePage: PublicLegalPage;
  onSelectPage: (page: PublicLegalPage) => void;
  onBackHome: () => void;
}> = ({ activePage, onSelectPage, onBackHome }) => {
  const { t } = useI18n();

  const tabs: Array<{
    id: PublicLegalPage;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'privacy', label: t('legal.navPrivacy'), icon: Lock },
    { id: 'terms', label: t('legal.navTerms'), icon: FileCheck2 },
    { id: 'refund-policy', label: t('legal.navRefund'), icon: RefreshCw },
    { id: 'contact', label: t('legal.navContact'), icon: HelpCircle },
  ];

  const contentMap: Record<PublicLegalPage, { title: string; p1: string; p2: string }> = {
    privacy: {
      title: t('legal.navPrivacy'),
      p1: t('legal.privacyBody1'),
      p2: t('legal.privacyBody2'),
    },
    terms: {
      title: t('legal.navTerms'),
      p1: t('legal.termsBody1'),
      p2: t('legal.termsBody2'),
    },
    'refund-policy': {
      title: t('legal.navRefund'),
      p1: t('legal.refundBody1'),
      p2: t('legal.refundBody2'),
    },
    contact: {
      title: t('legal.navContact'),
      p1: t('legal.contactBody1'),
      p2: t('legal.contactBody2'),
    },
  };

  const activeContent = contentMap[activePage];

  return (
    <div className="bg-mesh-hero min-h-screen text-[#131b2e] dark:text-[#eef0ff]">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <BrandLogoButton
            size="sm"
            ariaLabel={`${t('brand.name')} — ${t('auth.backHome')}`}
            onClick={onBackHome}
          />
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#131b2e] hover:text-[#064E3B] dark:text-[#eef0ff] dark:hover:text-[#b0f0d6]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t('auth.backHome')}</span>
          </button>
        </div>
        <LanguageToggle />
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = tab.id === activePage;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectPage(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                  selected
                    ? 'bg-[#064E3B] text-white shadow-xs dark:bg-[#0F766E]'
                    : 'border border-[#bfc9c3]/70 bg-white text-[#404944] hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:bg-[#131b2e] dark:text-[#bfc9c3]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <article className="wdw-card-elevated space-y-4 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F1F5F9] pb-4 dark:border-[#232f4f]">
            <h1 className="text-2xl font-bold tracking-tight text-[#131b2e] dark:text-white">
              {activeContent.title}
            </h1>
            <span className="rounded-full bg-[#f2f3ff] px-3 py-1 text-[11px] font-semibold text-[#404944] dark:bg-[#1c2640] dark:text-[#bfc9c3]">
              {t('legal.lastUpdated')}
            </span>
          </div>
          <p className="text-[15px] leading-[24px] text-[#131b2e] dark:text-[#eef0ff]">
            {activeContent.p1}
          </p>
          <p className="text-[15px] leading-[24px] text-[#404944] dark:text-[#bfc9c3]">
            {activeContent.p2}
          </p>
        </article>
      </main>
    </div>
  );
};
