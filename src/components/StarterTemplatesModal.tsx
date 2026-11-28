import React, { useCallback, useState } from 'react';
import {
  ArrowLeft,
  Briefcase,
  Calculator,
  CheckCircle2,
  Database,
  FilePlus2,
  GraduationCap,
  HeartHandshake,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import { buildStarterTemplateState, type StarterTemplateId } from '../utils/starterTemplates';
import { BrandMark } from './BrandMark';
import { useModalA11y } from '../hooks/useModalA11y';
import { useI18n } from '../i18n/useI18n';

type MemberSetupOption = 'solo' | 'couple' | 'joint';

export const StarterTemplatesModal: React.FC<{
  open?: boolean;
  onClose?: () => void;
}> = ({ open: forcedOpen, onClose }) => {
  const {
    state,
    authSession,
    activeProfile,
    activeView,
    roleCapabilities,
    updateSettings,
    dispatchStarterTemplate,
    isOauthOnboardingOpen,
    dismissOauthOnboarding,
    pendingPostAuthPlan,
  } = useFinance();
  const { t } = useI18n();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedTemplate, setSelectedTemplate] = useState<StarterTemplateId>('salaried');
  const [memberSetup, setMemberSetup] = useState<MemberSetupOption>('couple');

  const suppressAutoShow = activeView === 'pricing' || Boolean(pendingPostAuthPlan);
  const shouldAutoShow =
    !suppressAutoShow &&
    (isOauthOnboardingOpen ||
      (import.meta.env.MODE !== 'test' &&
        Boolean(authSession && !authSession.isDemo) &&
        roleCapabilities.canDeleteHouseholdData &&
        state.transactions.length === 0 &&
        !state.settings.onboardingDismissed));

  const isOpen = forcedOpen ?? shouldAutoShow;

  const handleDismiss = useCallback(() => {
    updateSettings({ onboardingDismissed: true });
    dismissOauthOnboarding();
    setStep(1);
    onClose?.();
  }, [dismissOauthOnboarding, onClose, updateSettings]);

  const dialogRef = useModalA11y(isOpen, handleDismiss);

  if (!isOpen) return null;

  const applySelectedSetup = (tplId: StarterTemplateId, membersChoice?: MemberSetupOption) => {
    let next = buildStarterTemplateState(state, tplId, activeProfile.id);

    if (membersChoice === 'solo') {
      const ownerMember =
        next.members.find((m) => m.id === activeProfile.id) ??
        next.members.find((m) => m.role === 'admin') ??
        next.members[0];
      if (ownerMember) {
        next = {
          ...next,
          members: [ownerMember],
          accounts: next.accounts.map((acc) => ({
            ...acc,
            ownerId: ownerMember.id,
            nomineeName:
              acc.nomineeName === 'Partner' ? state.accounts[0]?.nomineeName : acc.nomineeName,
          })),
          transactions: next.transactions.map((tx) => {
            const nextMemberId =
              tx.memberId === ownerMember.id || tx.memberId === 'm-shared'
                ? tx.memberId
                : ownerMember.id;
            if (!tx.memberSplits) {
              return nextMemberId === tx.memberId ? tx : { ...tx, memberId: nextMemberId };
            }
            const { memberSplits: _removedSplits, ...rest } = tx;
            return { ...rest, memberId: nextMemberId };
          }),
        };
      }
    }

    if (membersChoice === 'couple' || membersChoice === 'joint') {
      const hasPartner = next.members.some((m) => m.role === 'partner');
      if (!hasPartner) {
        next = {
          ...next,
          members: [
            ...next.members,
            {
              id: `m-partner-${Date.now().toString(36)}`,
              name: 'Partner',
              role: 'partner',
              avatar: '👩🏽‍🎨',
              color: '#0F766E',
              monthlyAllowance: next.settings.baseCurrency === 'INR' ? 40000 : 1200,
            },
          ],
        };
      }
    }

    if (membersChoice === 'joint') {
      const hasDependent = next.members.some((m) => m.role === 'dependent');
      if (!hasDependent) {
        next = {
          ...next,
          members: [
            ...next.members,
            {
              id: `m-dependent-${Date.now().toString(36)}`,
              name: 'Family Member',
              role: 'dependent',
              avatar: '🧒🏽',
              color: '#D97706',
              monthlyAllowance: next.settings.baseCurrency === 'INR' ? 10000 : 250,
            },
          ],
        };
      }
    }

    dispatchStarterTemplate(next);
    dismissOauthOnboarding();
    setStep(1);
    onClose?.();
  };

  const handleApply = (tplId: StarterTemplateId) => {
    applySelectedSetup(tplId);
  };

  const templates: Array<{
    id: StarterTemplateId;
    title: string;
    desc: string;
    defaultMembers: MemberSetupOption;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }> = [
    {
      id: 'salaried',
      title: t('onb.tplSalariedTitle'),
      desc: t('onb.tplSalariedDesc'),
      defaultMembers: 'couple',
      icon: Briefcase,
      color: 'bg-[#003527]/10 text-[#003527]',
    },
    {
      id: 'couple',
      title: t('onb.tplCoupleTitle'),
      desc: t('onb.tplCoupleDesc'),
      defaultMembers: 'couple',
      icon: HeartHandshake,
      color: 'bg-[#0F766E]/10 text-[#0F766E]',
    },
    {
      id: 'student',
      title: t('onb.tplStudentTitle'),
      desc: t('onb.tplStudentDesc'),
      defaultMembers: 'solo',
      icon: GraduationCap,
      color: 'bg-[#FEF3C7] text-[#904d00]',
    },
    {
      id: 'blank',
      title: t('onb.tplBlankTitle'),
      desc: t('onb.tplBlankDesc'),
      defaultMembers: 'solo',
      icon: FilePlus2,
      color: 'bg-[#f3f0fc] text-[#131b2e]',
    },
  ];

  const memberOptions: Array<{
    id: MemberSetupOption;
    label: string;
  }> = [
    { id: 'solo', label: t('onb.memberOpt1') },
    { id: 'couple', label: t('onb.memberOpt2') },
    { id: 'joint', label: t('onb.memberOpt3') },
  ];

  const checklistItems: Array<{
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    desc: string;
  }> = [
    { icon: TrendingUp, title: t('onb.chk1Title'), desc: t('onb.chk1Desc') },
    { icon: ShieldCheck, title: t('onb.chk2Title'), desc: t('onb.chk2Desc') },
    { icon: Calculator, title: t('onb.chk3Title'), desc: t('onb.chk3Desc') },
    { icon: UserCheck, title: t('onb.chk4Title'), desc: t('onb.chk4Desc') },
    { icon: Database, title: t('onb.chk5Title'), desc: t('onb.chk5Desc') },
  ];

  const stepLabels = [t('onb.stepDot1'), t('onb.stepDot2'), t('onb.stepDot3')];
  const selectedTplObj = templates.find((item) => item.id === selectedTemplate) ?? templates[0];
  const selectedMembersObj =
    memberOptions.find((item) => item.id === memberSetup) ?? memberOptions[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('onb.modalTitle')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#131b2e]/55 p-3 backdrop-blur-xs sm:p-4"
    >
      <div
        ref={dialogRef}
        className="grid max-h-[92vh] w-full max-w-4xl grid-cols-1 overflow-y-auto rounded-3xl bg-[#ffffff] text-[#131b2e] shadow-2xl lg:grid-cols-12"
      >
        {/* Left Light Pane */}
        <div className="flex flex-col justify-between bg-[#ffffff] p-5 sm:p-8 lg:col-span-7">
          <div>
            {/* Top Bar: BrandMark + Welcome + Close */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <BrandMark size="md" />
                <div>
                  <p className="text-xs font-bold tracking-tight text-[#003527]">
                    {t('onb.welcomeTitle')}
                  </p>
                  <h2 className="font-display mt-0.5 text-lg font-bold tracking-tight text-[#131b2e] sm:text-xl">
                    {t('onb.modalTitle')}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label={t('onb.closeAria')}
                className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-[#404944] transition hover:bg-[#f3f0fc] hover:text-[#131b2e]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-[#404944]">{t('onb.welcomeSub')}</p>

            {/* 3-Step Dot Indicator */}
            <div
              data-testid="onboarding-step-dots"
              className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#e3dfeb] bg-[#faf8ff] px-3.5 py-2.5"
            >
              {stepLabels.map((label, index) => {
                const stepNum = (index + 1) as 1 | 2 | 3;
                const isActive = step === stepNum;
                const isDone = step > stepNum;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setStep(stepNum)}
                    aria-current={isActive ? 'step' : undefined}
                    className="inline-flex min-h-[44px] items-center gap-2 text-left text-xs font-semibold"
                  >
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full transition ${
                        isActive
                          ? 'scale-110 bg-[#003527]'
                          : isDone
                          ? 'bg-[#0F766E]'
                          : 'bg-[#CBD5E1]'
                      }`}
                    />
                    <span
                      className={
                        isActive
                          ? 'font-bold text-[#003527]'
                          : isDone
                          ? 'text-[#0F766E]'
                          : 'text-[#707974]'
                      }
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Step 1: Pick Template (with 1-click Use Template on every card) */}
            {step === 1 && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {templates.map((tpl) => {
                  const Icon = tpl.icon;
                  const isSelected = selectedTemplate === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedTemplate(tpl.id);
                        setMemberSetup(tpl.defaultMembers);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedTemplate(tpl.id);
                          setMemberSetup(tpl.defaultMembers);
                        }
                      }}
                      className={`flex cursor-pointer flex-col justify-between rounded-2xl border p-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] ${
                        isSelected
                          ? 'border-[#003527] bg-[#faf8ff] ring-1 ring-[#003527]'
                          : 'border-[#e3dfeb] bg-[#ffffff] hover:border-[#0F766E]/50 hover:bg-[#faf8ff]'
                      }`}
                    >
                      <div>
                        <div
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${tpl.color}`}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <h3 className="mt-2.5 text-sm font-semibold text-[#131b2e]">{tpl.title}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-[#404944]">{tpl.desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApply(tpl.id);
                        }}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                        }}
                        className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#003527] px-3 py-2 text-xs font-bold text-[#ffffff] shadow-xs transition hover:bg-[#064E3B]"
                      >
                        {t('onb.applyBtn')}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Step 2: Select Members */}
            {step === 2 && (
              <div className="mt-5 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-[#131b2e]">{t('onb.membersHeading')}</h3>
                  <p className="mt-1 text-xs text-[#404944]">{t('onb.membersSub')}</p>
                </div>
                <div className="space-y-2.5">
                  {memberOptions.map((opt) => {
                    const active = memberSetup === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setMemberSetup(opt.id)}
                        className={`flex min-h-[44px] w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-xs font-semibold transition ${
                          active
                            ? 'border-[#003527] bg-[#faf8ff] text-[#003527] ring-1 ring-[#003527]'
                            : 'border-[#e3dfeb] bg-[#ffffff] text-[#131b2e] hover:bg-[#faf8ff]'
                        }`}
                      >
                        <span className="inline-flex items-center gap-2.5">
                          <Users className="h-4 w-4 text-[#0F766E]" aria-hidden="true" />
                          <span>{opt.label}</span>
                        </span>
                        <span
                          className={`h-4 w-4 rounded-full border-2 ${
                            active
                              ? 'border-[#003527] bg-[#003527]'
                              : 'border-[#CBD5E1] bg-[#ffffff]'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 3: Launch Vault */}
            {step === 3 && (
              <div className="mt-5 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[#131b2e]">{t('onb.launchHeading')}</h3>
                  <p className="mt-1 text-xs text-[#404944]">{t('onb.launchSub')}</p>
                </div>
                <div className="space-y-2.5 rounded-2xl border border-[#e3dfeb] bg-[#faf8ff] p-4 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#404944]">{t('onb.launchTemplateLabel')}</span>
                    <span className="font-bold text-[#003527]">{selectedTplObj.title}</span>
                  </div>
                  <div className="h-px bg-[#e3dfeb]" />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#404944]">{t('onb.launchMembersLabel')}</span>
                    <span className="font-bold text-[#003527]">{selectedMembersObj.label}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Step Navigation Footer */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#e3dfeb] pt-4">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#e3dfeb] bg-[#ffffff] px-4 text-xs font-semibold text-[#131b2e] hover:bg-[#faf8ff]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{t('onb.backBtn')}</span>
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#003527] bg-[#ffffff] px-5 text-xs font-bold text-[#003527] transition hover:bg-[#f3f0fc]"
              >
                {t('onb.nextBtn')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => applySelectedSetup(selectedTemplate, memberSetup)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#003527] px-5 text-xs font-bold text-[#ffffff] shadow-xs transition hover:bg-[#064E3B]"
              >
                {t('onb.launchVaultBtn')}
              </button>
            )}
          </div>
        </div>

        {/* Right Accent Panel (#003527 Deep Sanctuary Emerald) */}
        <div className="flex flex-col justify-between bg-[#003527] p-6 text-[#ffffff] sm:p-8 lg:col-span-5">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold text-[#b0f0d6]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#D97706]" aria-hidden="true" />
              <span>{t('brand.name')}</span>
            </div>
            <h3 className="font-display mt-3 text-lg font-bold tracking-tight text-[#ffffff]">
              {t('onb.checklistTitle')}
            </h3>

            <ul className="mt-5 divide-y divide-white/15">
              {checklistItems.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.title} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-[#b0f0d6]">
                      <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#ffffff]">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-[#D97706]" aria-hidden="true" />
                        <span>{item.title}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-[#b0f0d6]/90">
                        {item.desc}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="mt-6 border-t border-white/15 pt-4 text-[11px] text-[#b0f0d6]/85">
            {t('auth.montageTrustLine')}
          </p>
        </div>
      </div>
    </div>
  );
};
