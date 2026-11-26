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
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#131b2e]/55 px-4 pt-16 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={t('palette.dialogLabel')}
    >
      <div
        ref={dialogRef}
        className="wdw-card-elevated w-full max-w-xl overflow-hidden rounded-2xl"
      >
        <div className="flex items-center gap-2.5 border-b border-[#F1F5F9] px-4 py-3 dark:border-[#232f4f]">
          <Search className="h-4 w-4 text-[#0F766E]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={t('palette.placeholder')}
            className="flex-1 border-none bg-transparent text-sm text-[#131b2e] placeholder:text-[#707974] focus:shadow-none focus:outline-none dark:text-white"
            aria-label={t('palette.searchLabel')}
          />
          <button
            type="button"
            onClick={closeCommandPalette}
            className="rounded-lg p-1 text-[#707974] hover:bg-[#f2f3ff] hover:text-[#131b2e] dark:hover:bg-[#1c2640]"
            aria-label={t('palette.closeLabel')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2" role="listbox">
          {items.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#404944] dark:text-[#bfc9c3]">
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
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition ${
                    selected
                      ? 'bg-[#064E3B]/10 text-[#064E3B] dark:bg-[#064E3B]/45 dark:text-[#b0f0d6]'
                      : 'text-[#131b2e] hover:bg-[#f2f3ff] dark:text-[#eef0ff] dark:hover:bg-[#1c2640]'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f2f3ff] text-[#064E3B] dark:bg-[#1c2640] dark:text-[#b0f0d6]">
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
                      <div className="truncate text-xs font-semibold">{item.label}</div>
                      {item.subtitle && (
                        <div className="truncate text-[11px] text-[#404944] dark:text-[#bfc9c3]">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="ml-2 shrink-0 rounded-full bg-[#f2f3ff] px-2 py-0.5 text-[10px] font-semibold text-[#404944] dark:bg-[#1c2640] dark:text-[#bfc9c3]">
                    {item.groupLabel}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#F1F5F9] bg-[#f2f3ff]/70 px-4 py-2 text-[11px] text-[#404944] dark:border-[#232f4f] dark:bg-[#172036] dark:text-[#bfc9c3]">
          <span>{t('palette.footerHint')}</span>
          <span className="font-numeric font-semibold">Ctrl/⌘ + K</span>
        </div>
      </div>
    </div>
  );
};
