import React from 'react';
import { ArrowLeft, FileCheck2, HelpCircle, Lock, RefreshCw } from 'lucide-react';
import type { PublicLegalPage } from '../types/finance';
import { LanguageToggle } from '../components/LanguageToggle';
import { BrandMark } from '../components/BrandMark';
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
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <BrandMark size="sm" />
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-emerald-600 dark:text-slate-200"
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
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  selected
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <article className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {activeContent.title}
            </h1>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {t('legal.lastUpdated')}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {activeContent.p1}
          </p>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {activeContent.p2}
          </p>
        </article>
      </main>
    </div>
  );
};
