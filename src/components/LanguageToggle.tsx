import React from 'react';
import { Languages } from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import { translate } from '../i18n';
import type { AppLanguage } from '../types/finance';

export const LanguageToggle: React.FC<{
  variant?: 'compact' | 'pill';
  forceLight?: boolean;
}> = ({ variant = 'compact', forceLight = false }) => {
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
      className={`inline-flex items-center rounded-xl border border-[#bfc9c3]/70 ${
        forceLight
          ? 'bg-[#faf8ff]'
          : 'bg-[#f2f3ff] dark:border-[#2f3b52] dark:bg-[#172036]'
      } p-0.5 ${variant === 'pill' ? 'gap-1 shadow-2xs' : 'gap-0.5'}`}
    >
      <span
        className={`hidden items-center pl-1.5 pr-0.5 text-[#404944] sm:inline-flex${
          forceLight ? '' : ' dark:text-[#bfc9c3]'
        }`}
        aria-hidden="true"
      >
        <Languages className="h-3.5 w-3.5" />
      </span>
      <button
        type="button"
        onClick={() => setLang('en')}
        aria-pressed={language === 'en'}
        className={`inline-flex min-h-[44px] items-center justify-center rounded-lg px-2.5 py-1 text-xs font-semibold tracking-[0.02em] transition ${
          language === 'en'
            ? `bg-[#064E3B] text-[#ffffff] shadow-2xs${forceLight ? '' : ' dark:bg-[#0F766E]'}`
            : `text-[#404944] hover:text-[#131b2e]${
                forceLight ? '' : ' dark:text-[#bfc9c3] dark:hover:text-white'
              }`
        }`}
      >
        {variant === 'pill' ? 'English' : 'EN'}
      </button>
      <button
        type="button"
        onClick={() => setLang('gu')}
        aria-pressed={language === 'gu'}
        className={`inline-flex min-h-[44px] items-center justify-center rounded-lg px-2.5 py-1 text-xs font-medium transition ${
          language === 'gu'
            ? `bg-[#064E3B] text-[#ffffff] shadow-2xs${forceLight ? '' : ' dark:bg-[#0F766E]'}`
            : `text-[#404944] hover:text-[#131b2e]${
                forceLight ? '' : ' dark:text-[#bfc9c3] dark:hover:text-white'
              }`
        }`}
      >
        {variant === 'pill' ? 'ગુજરાતી' : 'ગુજ'}
      </button>
    </div>
  );
};
