import React from 'react';
import { Languages } from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import { translate } from '../i18n';
import type { AppLanguage } from '../types/finance';

export const LanguageToggle: React.FC<{ variant?: 'compact' | 'pill' }> = ({
  variant = 'compact',
}) => {
  const { state, updateSettings } = useFinance();
  const language: AppLanguage = state.settings.language ?? 'en';

  const setLang = (next: AppLanguage) => {
    if (next !== language) {
      updateSettings({ language: next });
    }
  };

  return (
    <div
      role="group"
      aria-label={translate(language, 'a11y.langSwitcher')}
      data-testid="language-switcher"
      className={`inline-flex items-center rounded-xl border border-slate-200 bg-slate-100/90 p-0.5 dark:border-slate-700 dark:bg-slate-800 ${
        variant === 'pill' ? 'gap-1 shadow-xs' : 'gap-0.5'
      }`}
    >
      <span
        className="hidden items-center pl-1.5 pr-0.5 text-slate-500 sm:inline-flex dark:text-slate-400"
        aria-hidden="true"
      >
        <Languages className="h-3.5 w-3.5" />
      </span>
      <button
        type="button"
        onClick={() => setLang('en')}
        aria-pressed={language === 'en'}
        className={`rounded-lg px-2 py-1 text-xs font-bold transition ${
          language === 'en'
            ? 'bg-blue-600 text-white shadow-2xs'
            : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
        }`}
      >
        {variant === 'pill' ? 'English' : 'EN'}
      </button>
      <button
        type="button"
        onClick={() => setLang('gu')}
        aria-pressed={language === 'gu'}
        className={`rounded-lg px-2 py-1 text-xs font-bold transition ${
          language === 'gu'
            ? 'bg-blue-600 text-white shadow-2xs'
            : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
        }`}
      >
        {variant === 'pill' ? 'ગુજરાતી' : 'ગુજ'}
      </button>
    </div>
  );
};
