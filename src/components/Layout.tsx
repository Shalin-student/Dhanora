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
import { BrandMark } from './BrandMark';
import { FeedbackModal } from './FeedbackModal';
import { LanguageToggle } from './LanguageToggle';

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
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-blue-600 focus:px-3 focus:py-2 focus:text-xs focus:font-bold focus:text-white"
      >
        {t('a11y.skipToContent')}
      </a>
      {/* Mobile drawer backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Grouped 4-Section Sidebar */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label={t('a11y.primaryNav')}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <BrandMark size="md" />
            <div>
              <div className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">
                {t('brand.name')}
              </div>
              <div className="max-w-[130px] truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {entityText(state.settings.householdName)}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-slate-500 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-label={t('a11y.closeNav')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {visibleGroups.map((group) => (
            <div key={group.groupKey}>
              <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
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
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                        active
                          ? 'bg-emerald-50 text-emerald-700 shadow-2xs dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
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

        <div className="space-y-3 border-t border-slate-200 p-4 dark:border-slate-800">
          {/* Authenticated Account Badge */}
          <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/70">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-lg">{activeProfile.avatar}</span>
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-slate-900 dark:text-white">
                    {memName(activeProfile)}
                  </div>
                  <div className="truncate text-[10px] text-slate-500">
                    {authSession?.email ?? ''}
                  </div>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                {roleBadge(activeProfile.role)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-200/70 pt-2 text-[11px] dark:border-slate-700">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveView('pricing');
                    setMobileMenuOpen(false);
                  }}
                  className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
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
                    className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-700"
                  >
                    {t('layout.upgradeShort')}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={signOut}
                className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-rose-600 dark:text-slate-300"
              >
                <LogOut className="h-3 w-3" />
                {t('layout.signOut')}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openQuickAdd(null)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
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
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <MessageSquarePlus className="h-3.5 w-3.5 text-emerald-600" />
            <span>{t('fb.openBtn')}</span>
          </button>
        </div>
      </aside>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

      {/* Main Column */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        {/* Top Bar */}
        <header className="no-print sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden dark:border-slate-700 dark:text-slate-300"
              aria-label={t('a11y.openNav')}
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Month Selector */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-1.5 py-1 dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
                className="rounded-lg p-1 text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700"
                aria-label={t('a11y.prevMonth')}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="tabular-nums min-w-[88px] text-center text-xs font-bold text-slate-800 dark:text-slate-100">
                {formatMonth(selectedMonth)}
              </span>
              <button
                type="button"
                onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
                className="rounded-lg p-1 text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700"
                aria-label={t('a11y.nextMonth')}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Family Member Filter */}
            {roleCapabilities.isDependent ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
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
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
                className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition ${
                  syncStatus === 'synced'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : syncStatus === 'connecting'
                    ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
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
                <span className="hidden sm:inline">
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
                className="inline-flex items-center gap-1 rounded-xl bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300"
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
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
                title={t('layout.installTitle')}
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('layout.installApp')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={openCommandPalette}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              aria-label={t('a11y.commandPalette')}
              title={t('layout.jumpTitle')}
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{t('layout.jump')}</span>
              <kbd className="hidden rounded bg-white px-1 py-0.5 text-[10px] font-bold text-slate-500 shadow-2xs sm:inline dark:bg-slate-900 dark:text-slate-400">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => updateSettings({ privacyMode: !state.settings.privacyMode })}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              title={t('layout.privacyTitle')}
              aria-label={t('a11y.privacyToggle')}
            >
              {state.settings.privacyMode ? (
                <EyeOff className="h-4 w-4 text-amber-500" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {state.settings.privacyMode ? t('layout.hidden') : t('layout.privacy')}
              </span>
            </button>

            <button
              type="button"
              onClick={handleToggleTheme}
              className="rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label={t('a11y.darkToggle')}
              title={t('layout.themeTitle')}
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </button>

            {state.settings.pinEnabled && (
              <button
                type="button"
                onClick={lockApp}
                className="rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-label={t('a11y.lockApp')}
                title={t('layout.lockTitle')}
              >
                <Lock className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => openQuickAdd(null)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 lg:hidden"
            >
              <Plus className="h-4 w-4" />
              {t('layout.addShort')}
            </button>
          </div>
        </header>

        <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 p-4 pb-24 sm:p-6 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Sleek Mobile Bottom Quick-Nav (uses distinct aria-labels to avoid desktop sidebar conflicts) */}
      <nav
        aria-label="Mobile quick navigation"
        className="no-print fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-slate-200 bg-white/95 px-2 py-1.5 backdrop-blur-md lg:hidden dark:border-slate-800 dark:bg-slate-900/95"
      >
        <button
          type="button"
          aria-label="Bottom bar home"
          onClick={() => setActiveView('dashboard')}
          className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-bold ${
            activeView === 'dashboard' ? 'text-emerald-600' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Home className="h-4 w-4" />
          <span aria-hidden="true">Home</span>
        </button>
        <button
          type="button"
          aria-label="Bottom bar ledger"
          onClick={() => setActiveView('transactions')}
          className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-bold ${
            activeView === 'transactions' ? 'text-emerald-600' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <ArrowLeftRight className="h-4 w-4" />
          <span aria-hidden="true">Ledger</span>
        </button>
        <button
          type="button"
          aria-label="Bottom bar quick entry"
          onClick={() => openQuickAdd(null)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md hover:bg-emerald-700"
        >
          <Plus className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Bottom bar targets"
          onClick={() => setActiveView('goals')}
          className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-bold ${
            activeView === 'goals' ? 'text-emerald-600' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Target className="h-4 w-4" />
          <span aria-hidden="true">Goals</span>
        </button>
        <button
          type="button"
          aria-label="Bottom bar menu"
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-bold text-slate-500 dark:text-slate-400"
        >
          <Menu className="h-4 w-4" />
          <span aria-hidden="true">{t('layout.mobileMore')}</span>
        </button>
      </nav>
    </div>
  );
};
