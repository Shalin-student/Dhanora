import React, { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  Calculator,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudOff,
  Crown,
  Download,
  Eye,
  EyeOff,
  Home,
  Landmark,
  Lock,
  LogOut,
  Menu,
  MessageSquarePlus,
  Moon,
  PiggyBank,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Target,
  Users,
  Wand2,
  WifiOff,
  X,
} from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import type { ActiveView } from '../types/finance';
import { shiftMonth } from '../utils/calculations';
import { useI18n } from '../i18n/useI18n';
import type { TranslationKey } from '../i18n';
import { BrandLogoButton } from './BrandMark';
import { FeedbackModal } from './FeedbackModal';
import { LanguageToggle } from './LanguageToggle';
import { MemberRoleAvatar } from './WdwPrimitives';

const NAV_GROUPS: Array<{
  groupKey: TranslationKey;
  items: Array<{
    id: ActiveView;
    labelKey: TranslationKey;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}> = [
  {
    groupKey: 'nav.groupMoney',
    items: [
      { id: 'dashboard', labelKey: 'nav.dashboard', icon: Home },
      { id: 'transactions', labelKey: 'nav.transactions', icon: ArrowLeftRight },
      { id: 'receipts', labelKey: 'nav.receipts', icon: Receipt },
      { id: 'budgets', labelKey: 'nav.budgets', icon: PiggyBank },
      { id: 'bills', labelKey: 'nav.bills', icon: CalendarClock },
    ],
  },
  {
    groupKey: 'nav.groupWealth',
    items: [
      { id: 'accounts', labelKey: 'nav.accounts', icon: Landmark },
      { id: 'goals', labelKey: 'nav.goals', icon: Target },
      { id: 'safety', labelKey: 'nav.safety', icon: ShieldCheck },
    ],
  },
  {
    groupKey: 'nav.groupTools',
    items: [
      { id: 'calculators', labelKey: 'nav.calculators', icon: Calculator },
      { id: 'automation', labelKey: 'nav.automation', icon: Wand2 },
      { id: 'reports', labelKey: 'nav.reports', icon: BarChart3 },
    ],
  },
  {
    groupKey: 'nav.groupWorkspace',
    items: [
      { id: 'family', labelKey: 'nav.family', icon: Users },
      { id: 'pricing', labelKey: 'nav.pricing', icon: Crown },
      { id: 'settings', labelKey: 'nav.settings', icon: Settings },
    ],
  },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    state,
    activeView,
    setActiveView,
    selectedMonth,
    setSelectedMonth,
    selectedMemberId,
    setSelectedMemberId,
    authSession,
    activeProfile,
    roleCapabilities,
    signOut,
    syncStatus,
    syncRevision,
    syncNow,
    openQuickAdd,
    openCommandPalette,
    isOnline,
    canInstallPwa,
    triggerInstallPwa,
    updateSettings,
    lockApp,
  } = useFinance();
  const { t, formatMonth, memName, entityText, roleBadge } = useI18n();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [activeView]);

  const isDark = state.settings.theme === 'dark';
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => roleCapabilities.allowedViews.includes(item.id)),
  })).filter((group) => group.items.length > 0);

  const currentPlan = state.settings.planTier ?? 'free';

  const handleToggleTheme = () => {
    updateSettings({ theme: isDark ? 'light' : 'dark' });
  };

  return (
    <div className="min-h-screen bg-[#faf8ff] text-[#131b2e] dark:bg-[#0b1120] dark:text-[#eef0ff]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-[#064E3B] focus:px-3 focus:py-2 focus:text-xs focus:font-bold focus:text-white"
      >
        {t('a11y.skipToContent')}
      </a>
      {/* Mobile drawer backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#131b2e]/50 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Grouped 4-Section Sidebar */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[#bfc9c3]/45 bg-white transition-transform duration-200 dark:border-[#232f4f] dark:bg-[#131b2e] lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label={t('a11y.primaryNav')}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-[#F1F5F9] px-4 dark:border-[#232f4f]">
          <BrandLogoButton
            size="md"
            subtitle={entityText(state.settings.householdName)}
            ariaLabel={`${t('brand.name')} — ${t('nav.dashboard')}`}
            onClick={() => {
              setActiveView('dashboard');
              setMobileMenuOpen(false);
            }}
            className="min-w-0 flex-1"
          />
          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-[#404944] hover:bg-[#f2f3ff] dark:text-[#bfc9c3] dark:hover:bg-[#1c2640] lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-label={t('a11y.closeNav')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {visibleGroups.map((group) => (
            <div key={group.groupKey}>
              <div className="label-caps mb-1.5 px-3 text-[#707974] dark:text-[#8d9791]">
                {t(group.groupKey)}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={active ? 'page' : undefined}
                      onClick={() => {
                        setActiveView(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                        active
                          ? 'bg-[#064E3B]/10 font-semibold text-[#064E3B] ring-1 ring-[#064E3B]/15 dark:bg-[#064E3B]/45 dark:text-[#b0f0d6] dark:ring-[#80bea6]/20'
                          : 'text-[#404944] hover:bg-[#f2f3ff] hover:text-[#131b2e] dark:text-[#bfc9c3] dark:hover:bg-[#1c2640] dark:hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{t(item.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-2.5 border-t border-[#F1F5F9] p-4 dark:border-[#232f4f]">
          {/* Authenticated Account Badge */}
          <div className="wdw-surface-tier rounded-xl p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <MemberRoleAvatar
                  avatar={activeProfile.avatar}
                  role={activeProfile.role}
                  name={memName(activeProfile)}
                  size="sm"
                />
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-[#131b2e] dark:text-white">
                    {memName(activeProfile)}
                  </div>
                  <div className="truncate text-[10px] text-[#404944] dark:text-[#bfc9c3]">
                    {authSession?.email ?? ''}
                  </div>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-[#064E3B]/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#064E3B] dark:bg-[#064E3B]/50 dark:text-[#b0f0d6]">
                {roleBadge(activeProfile.role)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-[#bfc9c3]/35 pt-2 text-[11px] dark:border-[#2f3b52]">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveView('pricing');
                    setMobileMenuOpen(false);
                  }}
                  className="font-semibold text-[#064E3B] hover:underline dark:text-[#b0f0d6]"
                >
                  {t('layout.planBadge', { plan: currentPlan.toUpperCase() })}
                </button>
                {currentPlan === 'free' && roleCapabilities.allowedViews.includes('pricing') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('pricing');
                      setMobileMenuOpen(false);
                    }}
                    className="wdw-btn-secondary px-1.5 py-0.5 text-[10px] font-bold"
                  >
                    {t('layout.upgradeShort')}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={signOut}
                className="inline-flex items-center gap-1 font-semibold text-[#404944] hover:text-[#ba1a1a] dark:text-[#bfc9c3]"
              >
                <LogOut className="h-3 w-3" />
                {t('layout.signOut')}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openQuickAdd(null)}
            className="wdw-btn-primary flex min-h-[40px] w-full items-center justify-center gap-2 px-4 py-2 text-sm font-semibold shadow-sm"
          >
            <Plus className="h-4 w-4" />
            {t('layout.addTransaction')}
          </button>

          <button
            type="button"
            onClick={() => {
              setFeedbackOpen(true);
              setMobileMenuOpen(false);
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#bfc9c3]/70 bg-white px-3 py-2 text-xs font-semibold text-[#404944] hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-[#bfc9c3] dark:hover:bg-[#1c2640]"
          >
            <MessageSquarePlus className="h-3.5 w-3.5 text-[#0F766E]" />
            <span>{t('fb.openBtn')}</span>
          </button>
        </div>
      </aside>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

      {/* Main Column */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        {/* Top Bar */}
        <header className="no-print sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-[#bfc9c3]/40 bg-[#faf8ff]/90 px-4 py-3 backdrop-blur-md dark:border-[#232f4f] dark:bg-[#0b1120]/90 sm:px-6 lg:px-10">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-[#bfc9c3]/70 bg-white text-[#404944] lg:hidden dark:border-[#2f3b52] dark:bg-[#131b2e] dark:text-[#eef0ff]"
              aria-label={t('a11y.openNav')}
            >
              <Menu className="h-5 w-5" />
            </button>

            <BrandLogoButton
              size="sm"
              ariaLabel={`${t('brand.name')} — ${t('nav.dashboard')}`}
              onClick={() => {
                setActiveView('dashboard');
                setMobileMenuOpen(false);
              }}
              className="min-w-0 max-w-[220px] sm:max-w-none lg:hidden"
            />

            {/* Month Selector */}
            <div className="flex items-center gap-1 rounded-lg border border-[#bfc9c3]/60 bg-white px-1.5 py-1 dark:border-[#2f3b52] dark:bg-[#131b2e]">
              <button
                type="button"
                onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
                className="rounded-md p-1 text-[#404944] hover:bg-[#f2f3ff] dark:text-[#bfc9c3] dark:hover:bg-[#1c2640]"
                aria-label={t('a11y.prevMonth')}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-numeric min-w-[88px] text-center text-xs font-semibold text-[#131b2e] dark:text-white">
                {formatMonth(selectedMonth)}
              </span>
              <button
                type="button"
                onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
                className="rounded-md p-1 text-[#404944] hover:bg-[#f2f3ff] dark:text-[#bfc9c3] dark:hover:bg-[#1c2640]"
                aria-label={t('a11y.nextMonth')}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Family Member Filter */}
            {roleCapabilities.isDependent ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FCD34D] bg-[#FEF3C7] px-3 py-1.5 text-xs font-semibold text-[#904d00] dark:border-[#904d00] dark:bg-[#904d00]/30 dark:text-[#ffdcc3]">
                {t('layout.scopedView', {
                  avatar: activeProfile.avatar,
                  name: memName(activeProfile),
                })}
              </span>
            ) : (
              <select
                aria-label={t('a11y.filterMember')}
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="max-w-full min-w-0 rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#131b2e] dark:border-[#2f3b52] dark:bg-[#131b2e] dark:text-[#eef0ff]"
              >
                <option value="all">👨‍👩‍👧‍👦 {t('layout.allMembers')}</option>
                {state.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.avatar} {memName(m)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <LanguageToggle />

            {state.settings.syncEnabled !== false && (
              <button
                type="button"
                onClick={() => void syncNow(false)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                  syncStatus === 'synced'
                    ? 'border-[#10B981]/30 bg-[#b0f0d6]/30 text-[#064E3B] dark:border-[#0F766E] dark:bg-[#064E3B]/40 dark:text-[#b0f0d6]'
                    : syncStatus === 'connecting'
                    ? 'border-[#FCD34D] bg-[#FEF3C7] text-[#904d00]'
                    : 'border-[#bfc9c3]/70 bg-white text-[#404944] dark:border-[#2f3b52] dark:bg-[#131b2e] dark:text-[#bfc9c3]'
                }`}
                title={
                  syncStatus === 'synced'
                    ? t('layout.syncTitleSynced', { rev: syncRevision })
                    : t('layout.syncTitleLocal')
                }
                aria-label={t('a11y.syncStatus')}
              >
                {syncStatus === 'synced' ? (
                  <Cloud className="h-3.5 w-3.5" />
                ) : syncStatus === 'connecting' ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CloudOff className="h-3.5 w-3.5" />
                )}
                <span className="font-numeric hidden sm:inline">
                  {syncStatus === 'synced'
                    ? t('layout.syncedRev', { rev: syncRevision })
                    : syncStatus === 'connecting'
                    ? t('layout.syncing')
                    : t('layout.localSync')}
                </span>
              </button>
            )}

            {!isOnline && (
              <span
                className="inline-flex items-center gap-1 rounded-lg bg-[#FEF3C7] px-2.5 py-1.5 text-xs font-semibold text-[#904d00]"
                title={t('layout.offlineTitle')}
              >
                <WifiOff className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('layout.offline')}</span>
              </span>
            )}

            {canInstallPwa && (
              <button
                type="button"
                onClick={() => void triggerInstallPwa()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#0F766E]/30 bg-[#9cf2e8]/30 px-2.5 py-1.5 text-xs font-semibold text-[#003430] hover:bg-[#9cf2e8]/50 dark:border-[#0F766E] dark:bg-[#004d47]/40 dark:text-[#9cf2e8]"
                title={t('layout.installTitle')}
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('layout.installApp')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={openCommandPalette}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#bfc9c3]/70 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#404944] hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:bg-[#131b2e] dark:text-[#bfc9c3] dark:hover:bg-[#1c2640]"
              aria-label={t('a11y.commandPalette')}
              title={t('layout.jumpTitle')}
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{t('layout.jump')}</span>
              <kbd className="font-numeric hidden rounded bg-[#f2f3ff] px-1 py-0.5 text-[10px] font-bold text-[#404944] sm:inline dark:bg-[#1c2640] dark:text-[#bfc9c3]">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => updateSettings({ privacyMode: !state.settings.privacyMode })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#bfc9c3]/70 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#131b2e] hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:bg-[#131b2e] dark:text-[#eef0ff] dark:hover:bg-[#1c2640]"
              title={t('layout.privacyTitle')}
              aria-label={t('a11y.privacyToggle')}
            >
              {state.settings.privacyMode ? (
                <EyeOff className="h-4 w-4 text-[#D97706]" />
              ) : (
                <Eye className="h-4 w-4 text-[#0F766E]" />
              )}
              <span className="hidden sm:inline">
                {state.settings.privacyMode ? t('layout.hidden') : t('layout.privacy')}
              </span>
            </button>

            <button
              type="button"
              onClick={handleToggleTheme}
              className="rounded-lg border border-[#bfc9c3]/70 bg-white p-2 text-[#131b2e] hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:bg-[#131b2e] dark:text-[#eef0ff] dark:hover:bg-[#1c2640]"
              aria-label={t('a11y.darkToggle')}
              title={t('layout.themeTitle')}
            >
              {isDark ? <Sun className="h-4 w-4 text-[#fe932c]" /> : <Moon className="h-4 w-4" />}
            </button>

            {state.settings.pinEnabled && (
              <button
                type="button"
                onClick={lockApp}
                className="rounded-lg border border-[#bfc9c3]/70 bg-white p-2 text-[#131b2e] hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:bg-[#131b2e] dark:text-[#eef0ff] dark:hover:bg-[#1c2640]"
                aria-label={t('a11y.lockApp')}
                title={t('layout.lockTitle')}
              >
                <Lock className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => openQuickAdd(null)}
              className="wdw-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold shadow-xs lg:hidden"
            >
              <Plus className="h-4 w-4" />
              {t('layout.addShort')}
            </button>
          </div>
        </header>

        <main id="main-content" className="mx-auto w-full max-w-[1280px] flex-1 p-4 pb-24 sm:p-6 lg:px-10 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Sleek Mobile Bottom Quick-Nav */}
      <nav
        aria-label="Mobile quick navigation"
        className="no-print fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-[#bfc9c3]/45 bg-white/95 px-2 py-1.5 backdrop-blur-md lg:hidden dark:border-[#232f4f] dark:bg-[#131b2e]/95"
      >
        <button
          type="button"
          aria-label="Bottom bar home"
          onClick={() => setActiveView('dashboard')}
          className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold ${
            activeView === 'dashboard' ? 'text-[#064E3B] dark:text-[#b0f0d6]' : 'text-[#404944] dark:text-[#bfc9c3]'
          }`}
        >
          <Home className="h-4 w-4" />
          <span aria-hidden="true">Home</span>
        </button>
        <button
          type="button"
          aria-label="Bottom bar ledger"
          onClick={() => setActiveView('transactions')}
          className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold ${
            activeView === 'transactions' ? 'text-[#064E3B] dark:text-[#b0f0d6]' : 'text-[#404944] dark:text-[#bfc9c3]'
          }`}
        >
          <ArrowLeftRight className="h-4 w-4" />
          <span aria-hidden="true">Ledger</span>
        </button>
        <button
          type="button"
          aria-label="Bottom bar quick entry"
          onClick={() => openQuickAdd(null)}
          className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-[#064E3B] text-white shadow-md hover:bg-[#043D2E]"
        >
          <Plus className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Bottom bar targets"
          onClick={() => setActiveView('goals')}
          className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold ${
            activeView === 'goals' ? 'text-[#064E3B] dark:text-[#b0f0d6]' : 'text-[#404944] dark:text-[#bfc9c3]'
          }`}
        >
          <Target className="h-4 w-4" />
          <span aria-hidden="true">Goals</span>
        </button>
        <button
          type="button"
          aria-label="Bottom bar menu"
          onClick={() => setMobileMenuOpen(true)}
          className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold text-[#404944] dark:text-[#bfc9c3]"
        >
          <Menu className="h-4 w-4" />
          <span aria-hidden="true">{t('layout.mobileMore')}</span>
        </button>
      </nav>
    </div>
  );
};
