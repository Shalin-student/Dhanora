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
      color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
    },
    {
      id: 'couple',
      title: t('onb.tplCoupleTitle'),
      desc: t('onb.tplCoupleDesc'),
      icon: HeartHandshake,
      color: 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300',
    },
    {
      id: 'student',
      title: t('onb.tplStudentTitle'),
      desc: t('onb.tplStudentDesc'),
      icon: GraduationCap,
      color: 'bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
    },
    {
      id: 'blank',
      title: t('onb.tplBlankTitle'),
      desc: t('onb.tplBlankDesc'),
      icon: FilePlus2,
      color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('onb.modalTitle')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              Canva-style Setup
            </div>
            <h2 className="mt-2 text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {t('onb.modalTitle')}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('onb.modalSub')}</p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close templates dialog"
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
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
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-emerald-400 hover:bg-white dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-emerald-700"
              >
                <div>
                  <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${tpl.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="mt-2.5 text-sm font-bold text-slate-900 dark:text-white">
                    {tpl.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {tpl.desc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleApply(tpl.id)}
                  className="mt-4 w-full rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
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
