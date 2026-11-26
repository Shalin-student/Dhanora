import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Eye,
  Moon,
  Plus,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import { useModalA11y } from '../hooks/useModalA11y';
import type { ActiveView } from '../types/finance';
import { formatMoney } from '../utils/currency';
import { useI18n } from '../i18n/useI18n';
import type { TranslationKey } from '../i18n';

interface PaletteItem {
  id: string;
  groupKind: 'nav' | 'action' | 'family' | 'tx';
  groupLabel: string;
  label: string;
  subtitle?: string;
  searchKeywords?: string;
  onSelect: () => void;
}

const VIEW_ENTRIES: Array<{
  id: ActiveView;
  labelKey: TranslationKey;
  subKey: TranslationKey;
}> = [
  { id: 'dashboard', labelKey: 'nav.dashboard', subKey: 'palette.viewSub.dashboard' },
  { id: 'transactions', labelKey: 'nav.transactions', subKey: 'palette.viewSub.transactions' },
  { id: 'receipts', labelKey: 'nav.receipts', subKey: 'palette.viewSub.receipts' },
  { id: 'budgets', labelKey: 'nav.budgets', subKey: 'palette.viewSub.budgets' },
  { id: 'bills', labelKey: 'nav.bills', subKey: 'palette.viewSub.bills' },
  { id: 'automation', labelKey: 'nav.automation', subKey: 'palette.viewSub.automation' },
  { id: 'goals', labelKey: 'nav.goals', subKey: 'palette.viewSub.goals' },
  { id: 'accounts', labelKey: 'nav.accounts', subKey: 'palette.viewSub.accounts' },
  { id: 'safety', labelKey: 'nav.safety', subKey: 'palette.viewSub.safety' },
  { id: 'calculators', labelKey: 'nav.calculators', subKey: 'palette.viewSub.calculators' },
  { id: 'family', labelKey: 'nav.family', subKey: 'palette.viewSub.family' },
  { id: 'reports', labelKey: 'nav.reports', subKey: 'palette.viewSub.reports' },
  { id: 'pricing', labelKey: 'nav.pricing', subKey: 'palette.viewSub.pricing' },
  { id: 'settings', labelKey: 'nav.settings', subKey: 'palette.viewSub.settings' },
];

export const CommandPalette: React.FC = () => {
  const {
    state,
    activeProfile,
    roleCapabilities,
    isCommandPaletteOpen,
    closeCommandPalette,
    setActiveView,
    setSelectedMemberId,
    openQuickAdd,
    updateSettings,
  } = useFinance();
  const { t, memName, roleBadge } = useI18n();

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useModalA11y(isCommandPaletteOpen, closeCommandPalette);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [isCommandPaletteOpen]);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();

    const quickActions: PaletteItem[] = [
      {
        id: 'act-add-tx',
        groupKind: 'action',
        groupLabel: t('palette.group.action'),
        label: t('palette.actAddTx'),
        subtitle: t('palette.actAddTxSub'),
        searchKeywords: 'add new transaction',
        onSelect: () => {
          closeCommandPalette();
          openQuickAdd(null);
        },
      },
      {
        id: 'act-theme',
        groupKind: 'action',
        groupLabel: t('palette.group.action'),
        label:
          state.settings.theme === 'dark'
            ? t('palette.switchLight')
            : t('palette.switchDark'),
        subtitle: t('palette.themeSub'),
        searchKeywords: 'theme light dark',
        onSelect: () => {
          updateSettings({ theme: state.settings.theme === 'dark' ? 'light' : 'dark' });
          closeCommandPalette();
        },
      },
      {
        id: 'act-privacy',
        groupKind: 'action',
        groupLabel: t('palette.group.action'),
        label: state.settings.privacyMode
          ? t('palette.disablePrivacy')
          : t('palette.enablePrivacy'),
        subtitle: t('palette.privacySub'),
        searchKeywords: 'privacy mask',
        onSelect: () => {
          updateSettings({ privacyMode: !state.settings.privacyMode });
          closeCommandPalette();
        },
      },
    ];

    const navItems: PaletteItem[] = VIEW_ENTRIES.filter((v) =>
      roleCapabilities.allowedViews.includes(v.id)
    ).map((v) => ({
      id: `nav-${v.id}`,
      groupKind: 'nav',
      groupLabel: t('palette.group.nav'),
      label: t(v.labelKey),
      subtitle: t(v.subKey),
      searchKeywords: v.id,
      onSelect: () => {
        setActiveView(v.id);
        closeCommandPalette();
      },
    }));

    const memberItems: PaletteItem[] = roleCapabilities.canViewAllMembers
      ? [
          {
            id: 'mem-all',
            groupKind: 'family',
            groupLabel: t('palette.group.family'),
            label: t('palette.filterAll'),
            subtitle: t('palette.filterAllSub'),
            onSelect: () => {
              setSelectedMemberId('all');
              closeCommandPalette();
            },
          },
          ...state.members.map((m) => ({
            id: `mem-${m.id}`,
            groupKind: 'family' as const,
            groupLabel: t('palette.group.family'),
            label: t('palette.filterMember', { avatar: m.avatar, name: memName(m) }),
            subtitle: t('palette.filterMemberSub', { role: roleBadge(m.role) }),
            searchKeywords: `${m.name} ${m.role}`,
            onSelect: () => {
              setSelectedMemberId(m.id);
              closeCommandPalette();
            },
          })),
        ]
      : [];

    const txItems: PaletteItem[] = state.transactions
      .filter((tx) => {
        if (roleCapabilities.isDependent && tx.memberId !== activeProfile.id) return false;
        if (!q) return false;
        const hay = `${tx.merchant} ${tx.note} ${tx.tags.join(' ')} ${tx.date}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 6)
      .map((tx) => ({
        id: `tx-${tx.id}`,
        groupKind: 'tx',
        groupLabel: t('palette.group.tx'),
        label: `${tx.merchant} (${formatMoney(tx.amount, tx.currency, state.settings.privacyMode)})`,
        subtitle: t('palette.editTxSub', { date: tx.date }),
        onSelect: () => {
          closeCommandPalette();
          openQuickAdd(tx);
        },
      }));

    const all = [...quickActions, ...navItems, ...memberItems, ...txItems];
    if (!q) return all.slice(0, 12);
    return all.filter(
      (item) =>
        item.groupKind === 'tx' ||
        item.label.toLowerCase().includes(q) ||
        (item.subtitle?.toLowerCase().includes(q) ?? false) ||
        (item.searchKeywords?.toLowerCase().includes(q) ?? false)
    );
  }, [
    query,
    state.members,
    state.transactions,
    state.settings.theme,
    state.settings.privacyMode,
    activeProfile.id,
    roleCapabilities.allowedViews,
    roleCapabilities.canViewAllMembers,
    roleCapabilities.isDependent,
    t,
    memName,
    roleBadge,
    closeCommandPalette,
    openQuickAdd,
    setActiveView,
    setSelectedMemberId,
    updateSettings,
  ]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!isCommandPaletteOpen) return null;

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((idx) => (items.length ? (idx + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((idx) => (items.length ? (idx - 1 + items.length) % items.length : 0));
    } else if (e.key === 'Enter' && items[activeIndex]) {
      e.preventDefault();
      items[activeIndex].onSelect();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 px-4 pt-16 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={t('palette.dialogLabel')}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center gap-2.5 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={t('palette.placeholder')}
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
            aria-label={t('palette.searchLabel')}
          />
          <button
            type="button"
            onClick={closeCommandPalette}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            aria-label={t('palette.closeLabel')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2" role="listbox">
          {items.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              {t('palette.empty')}
            </div>
          ) : (
            items.map((item, idx) => {
              const selected = idx === activeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={item.onSelect}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${
                    selected
                      ? 'bg-blue-50 text-blue-900 dark:bg-blue-950/60 dark:text-blue-100'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {item.id === 'act-add-tx' ? (
                        <Plus className="h-3.5 w-3.5" />
                      ) : item.id === 'act-theme' ? (
                        <Moon className="h-3.5 w-3.5" />
                      ) : item.id === 'act-privacy' ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : item.groupKind === 'family' ? (
                        <Users className="h-3.5 w-3.5" />
                      ) : item.groupKind === 'tx' ? (
                        <Sparkles className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold">{item.label}</div>
                      {item.subtitle && (
                        <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="ml-2 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {item.groupLabel}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/70">
          <span>{t('palette.footerHint')}</span>
          <span>Ctrl/⌘ + K</span>
        </div>
      </div>
    </div>
  );
};
