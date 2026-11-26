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
import { LanguageToggle } from './LanguageToggle';

const NAV_ITEMS: Array<{
  id: ActiveView;
  labelKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', labelKey: 'nav.dashboard', icon: Home },
  { id: 'transactions', labelKey: 'nav.transactions', icon: ArrowLeftRight },
  { id: 'receipts', labelKey: 'nav.receipts', icon: Receipt },
  { id: 'budgets', labelKey: 'nav.budgets', icon: PiggyBank },
  { id: 'bills', labelKey: 'nav.bills', icon: CalendarClock },
  { id: 'accounts', labelKey: 'nav.accounts', icon: Landmark },
  { id: 'goals', labelKey: 'nav.goals', icon: Target },
  { id: 'safety', labelKey: 'nav.safety', icon: ShieldCheck },
  { id: 'calculators', labelKey: 'nav.calculators', icon: Calculator },
  { id: 'automation', labelKey: 'nav.automation', icon: Wand2 },
  { id: 'family', labelKey: 'nav.family', icon: Users },
  { id: 'reports', labelKey: 'nav.reports', icon: BarChart3 },
  { id: 'pricing', labelKey: 'nav.pricing', icon: Crown },
  { id: 'settings', labelKey: 'nav.settings', icon: Settings },
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

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [activeView]);

  const isDark = state.settings.theme === 'dark';
  const visibleNavItems = NAV_ITEMS.filter((item) =>
    roleCapabilities.allowedViews.includes(item.id)
  );
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

      {/* Sidebar */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label={t('a11y.primaryNav')}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 text-lg text-white shadow-sm">
              🏡
            </div>
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

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {visibleNavItems.map((item) => {
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
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                  active
                    ? 'bg-blue-50 text-blue-700 shadow-xs dark:bg-blue-950/60 dark:text-blue-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{t(item.labelKey)}</span>
              </button>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-slate-200 p-4 dark:border-slate-800">
          {/* Authenticated Account Badge (Role detected from Sign In / Sign Up) */}
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
        </div>
      </aside>

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
              <span className="min-w-[88px] text-center text-xs font-bold text-slate-800 dark:text-slate-100">
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
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 lg:hidden"
            >
              <Plus className="h-4 w-4" />
              {t('layout.addShort')}
            </button>
          </div>
        </header>

        <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
