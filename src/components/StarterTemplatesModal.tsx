import React from 'react';
import { Briefcase, FilePlus2, GraduationCap, HeartHandshake, Sparkles, X } from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import { buildStarterTemplateState, type StarterTemplateId } from '../utils/starterTemplates';
import { useI18n } from '../i18n/useI18n';

export const StarterTemplatesModal: React.FC<{
  open?: boolean;
  onClose?: () => void;
}> = ({ open: forcedOpen, onClose }) => {
  const {
    state,
    authSession,
    activeProfile,
    roleCapabilities,
    updateSettings,
    dispatchStarterTemplate,
  } = useFinance();
  const { t } = useI18n();

  const shouldAutoShow =
    import.meta.env.MODE !== 'test' &&
    Boolean(authSession && !authSession.isDemo) &&
    roleCapabilities.canDeleteHouseholdData &&
    state.transactions.length === 0 &&
    !state.settings.onboardingDismissed;

  const isOpen = forcedOpen ?? shouldAutoShow;
  if (!isOpen) return null;

  const handleApply = (tplId: StarterTemplateId) => {
    const next = buildStarterTemplateState(state, tplId, activeProfile.id);
    dispatchStarterTemplate(next);
    onClose?.();
  };

  const handleDismiss = () => {
    updateSettings({ onboardingDismissed: true });
    onClose?.();
  };

  const templates: Array<{
    id: StarterTemplateId;
    title: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }> = [
    {
      id: 'salaried',
      title: t('onb.tplSalariedTitle'),
      desc: t('onb.tplSalariedDesc'),
      icon: Briefcase,
      color: 'bg-[#064E3B]/10 text-[#064E3B] dark:bg-[#064E3B]/45 dark:text-[#b0f0d6]',
    },
    {
      id: 'couple',
      title: t('onb.tplCoupleTitle'),
      desc: t('onb.tplCoupleDesc'),
      icon: HeartHandshake,
      color: 'bg-[#0F766E]/10 text-[#0F766E] dark:bg-[#004d47]/50 dark:text-[#9cf2e8]',
    },
    {
      id: 'student',
      title: t('onb.tplStudentTitle'),
      desc: t('onb.tplStudentDesc'),
      icon: GraduationCap,
      color: 'bg-[#FEF3C7] text-[#904d00] dark:bg-[#904d00]/40 dark:text-[#ffdcc3]',
    },
    {
      id: 'blank',
      title: t('onb.tplBlankTitle'),
      desc: t('onb.tplBlankDesc'),
      icon: FilePlus2,
      color: 'bg-[#eaedff] text-[#131b2e] dark:bg-[#232f4f] dark:text-[#eef0ff]',
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('onb.modalTitle')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#131b2e]/55 p-4 backdrop-blur-xs"
    >
      <div className="wdw-card-elevated w-full max-w-2xl rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FEF3C7] px-3 py-1 text-[11px] font-semibold text-[#904d00] dark:bg-[#904d00]/40 dark:text-[#ffdcc3]">
              <Sparkles className="h-3.5 w-3.5 text-[#D97706]" />
              Household Setup
            </div>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-[#131b2e] dark:text-white">
              {t('onb.modalTitle')}
            </h2>
            <p className="mt-1 text-xs text-[#404944] dark:text-[#bfc9c3]">{t('onb.modalSub')}</p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close templates dialog"
            className="rounded-lg p-1.5 text-[#707974] hover:bg-[#f2f3ff] hover:text-[#131b2e] dark:hover:bg-[#1c2640]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {templates.map((tpl) => {
            const Icon = tpl.icon;
            return (
              <div
                key={tpl.id}
                className="wdw-surface-tier flex flex-col justify-between rounded-2xl p-4 transition hover:border-[#0F766E]/40 hover:bg-white dark:hover:bg-[#1c2640]"
              >
                <div>
                  <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${tpl.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="mt-2.5 text-sm font-semibold text-[#131b2e] dark:text-white">
                    {tpl.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#404944] dark:text-[#bfc9c3]">
                    {tpl.desc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleApply(tpl.id)}
                  className="wdw-btn-primary mt-4 w-full py-2 text-xs font-semibold shadow-xs"
                >
                  {t('onb.applyBtn')}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
