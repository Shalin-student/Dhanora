import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Edit3,
  Pause,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import type { MerchantRule, RuleMatchType } from '../types/finance';
import { detectFinancialAnomalies } from '../utils/automation';
import { todayISO } from '../utils/calculations';
import { useI18n } from '../i18n/useI18n';

export const AutomationView: React.FC = () => {
  const {
    state,
    selectedMonth,
    upsertRule,
    deleteRule,
    applyRulesToExistingTransactions,
    runAutoPostNow,
  } = useFinance();
  const { language, t, formatMonth, catName, memName, matchTypeLabel } = useI18n();

  const [pattern, setPattern] = useState('');
  const [matchType, setMatchType] = useState<RuleMatchType>('contains');
  const [categoryId, setCategoryId] = useState(
    state.categories.find((c) => c.type === 'expense')?.id ?? state.categories[0]?.id ?? ''
  );
  const [memberId, setMemberId] = useState('');
  const [tagsText, setTagsText] = useState('');

  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleDraft, setRuleDraft] = useState<{
    pattern: string;
    matchType: RuleMatchType;
    categoryId: string;
    memberId: string;
    tagsText: string;
  } | null>(null);

  const startEditRule = (rule: MerchantRule) => {
    setEditingRuleId(rule.id);
    setRuleDraft({
      pattern: rule.pattern,
      matchType: rule.matchType,
      categoryId: rule.categoryId,
      memberId: rule.memberId ?? '',
      tagsText: (rule.tags ?? []).join(', '),
    });
  };

  const handleSaveRuleEdit = (rule: MerchantRule) => {
    if (!ruleDraft || !ruleDraft.pattern.trim() || !ruleDraft.categoryId) return;
    upsertRule({
      ...rule,
      pattern: ruleDraft.pattern.trim(),
      matchType: ruleDraft.matchType,
      categoryId: ruleDraft.categoryId,
      memberId: ruleDraft.memberId || undefined,
      tags: ruleDraft.tagsText
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    setEditingRuleId(null);
    setRuleDraft(null);
  };

  const today = todayISO();
  const autoPostRules = state.recurring.filter((r) => r.isActive && r.autoPost);
  const dueAutoPostCount = autoPostRules.filter((r) => r.nextDueDate <= today).length;

  const alerts = useMemo(
    () => detectFinancialAnomalies(state, selectedMonth, today, language),
    [state, selectedMonth, today, language]
  );

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern.trim() || !categoryId) return;
    upsertRule({
      id: `rule-${Date.now()}`,
      pattern: pattern.trim(),
      matchType,
      categoryId,
      memberId: memberId || undefined,
      tags: tagsText
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      isActive: true,
    });
    setPattern('');
    setTagsText('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#131b2e] dark:text-white">
            {t('auto.title')}
          </h1>
          <p className="text-sm text-[#404944] dark:text-[#707974]">
            {t('auto.subtitle', { month: formatMonth(selectedMonth) })}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => runAutoPostNow()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#bfc9c3]/60 bg-white px-3.5 py-2 text-xs font-semibold text-[#131b2e] hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:bg-[#131b2e] dark:text-[#eef0ff] dark:hover:bg-[#1c2640]"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#0F766E]" />
            {t('auto.runAutoCount', { count: dueAutoPostCount })}
          </button>
          <button
            type="button"
            onClick={() => applyRulesToExistingTransactions()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#064E3B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#043D2E]"
          >
            <Wand2 className="h-3.5 w-3.5" />
            {t('auto.applyRules')}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="wdw-card p-4">
          <div className="text-xs font-semibold text-[#404944]">{t('auto.activeRules')}</div>
          <div className="mt-1 text-2xl font-bold text-[#131b2e] dark:text-white">
            {(state.rules ?? []).filter((r) => r.isActive).length}
          </div>
        </div>
        <div className="wdw-card p-4">
          <div className="text-xs font-semibold text-[#404944]">{t('auto.autopaySchedules')}</div>
          <div className="mt-1 text-2xl font-bold text-[#10B981] dark:text-emerald-400">
            {autoPostRules.length}{' '}
            <span className="text-xs font-semibold text-[#404944]">
              {t('auto.dueNow', { count: dueAutoPostCount })}
            </span>
          </div>
        </div>
        <div className="wdw-card p-4">
          <div className="text-xs font-semibold text-[#404944]">{t('auto.activeAlerts')}</div>
          <div className="mt-1 text-2xl font-bold text-[#D97706] dark:text-amber-400">
            {alerts.length}
          </div>
        </div>
      </div>

      {/* Financial Alerts */}
      <section className="wdw-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <BellRing className="h-4 w-4 text-amber-500" />
          <h2 className="text-base font-bold text-[#131b2e] dark:text-white">
            {t('auto.alertsTitle')}
          </h2>
        </div>

        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl bg-[#b0f0d6]/35 px-3.5 py-3 text-xs font-medium text-[#064E3B] dark:bg-emerald-950/30 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {t('auto.noAlerts', { month: formatMonth(selectedMonth) })}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start gap-3 rounded-xl border p-3.5 ${
                  alert.severity === 'warning'
                    ? 'border-[#FCD34D] bg-[#FEF3C7]/70 dark:border-amber-900/60 dark:bg-amber-950/20'
                    : 'border-[#0F766E]/25 bg-[#f2f3ff] dark:border-[#0F766E]/50 dark:bg-[#004d47]/40'
                }`}
              >
                <AlertTriangle
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    alert.severity === 'warning' ? 'text-[#D97706]' : 'text-[#0F766E]'
                  }`}
                />
                <div>
                  <div className="text-xs font-bold text-[#131b2e] dark:text-white">
                    {alert.title}
                  </div>
                  <div className="mt-0.5 text-xs text-[#404944] dark:text-[#bfc9c3]">
                    {alert.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add Merchant Rule */}
      <form
        onSubmit={handleAddRule}
        className="wdw-card p-5"
      >
        <h2 className="mb-4 text-base font-bold text-[#131b2e] dark:text-white">
          {t('auto.createRuleTitle')}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            type="text"
            required
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder={t('auto.patternPlaceholder')}
            aria-label={t('auto.patternAria')}
            className="rounded-xl border border-[#CBD5E1] px-3 py-2 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
          />
          <select
            aria-label={t('auto.matchAria')}
            value={matchType}
            onChange={(e) => setMatchType(e.target.value as RuleMatchType)}
            className="rounded-xl border border-[#CBD5E1] px-3 py-2 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
          >
            <option value="contains">{matchTypeLabel('contains')}</option>
            <option value="startsWith">{matchTypeLabel('startsWith')}</option>
            <option value="exact">{matchTypeLabel('exact')}</option>
          </select>
          <select
            aria-label={t('auto.catAria')}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-xl border border-[#CBD5E1] px-3 py-2 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
          >
            {state.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {catName(c)}
              </option>
            ))}
          </select>
          <select
            aria-label={t('auto.memberAria')}
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="rounded-xl border border-[#CBD5E1] px-3 py-2 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
          >
            <option value="">{t('auto.keepMember')}</option>
            {state.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.avatar} {memName(m)}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder={t('auto.tagsPlaceholder')}
            aria-label={t('auto.tagsAria')}
            className="rounded-xl border border-[#CBD5E1] px-3 py-2 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#064E3B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#043D2E]"
          >
            <Plus className="h-4 w-4" />
            {t('auto.addRule')}
          </button>
        </div>
      </form>

      {/* Existing Rules */}
      <div className="wdw-card p-5">
        <h2 className="mb-3 text-base font-bold text-[#131b2e] dark:text-white">
          {t('auto.configuredRules')}
        </h2>
        {(state.rules ?? []).length === 0 ? (
          <p className="text-xs text-[#404944]">{t('auto.noRules')}</p>
        ) : (
          <div className="divide-y divide-[#F1F5F9] dark:divide-[#232f4f]">
            {(state.rules ?? []).map((rule) => {
              const cat = state.categories.find((c) => c.id === rule.categoryId);
              const mem = rule.memberId
                ? state.members.find((m) => m.id === rule.memberId)
                : undefined;
              const isEditing = editingRuleId === rule.id && ruleDraft;

              return (
                <div
                  key={rule.id}
                  className={`py-3 ${rule.isActive ? '' : 'opacity-60'}`}
                >
                  {isEditing ? (
                    <div className="space-y-2 rounded-xl border border-[#0F766E]/25 bg-[#f2f3ff] p-3 dark:border-[#0F766E]/50 dark:bg-[#004d47]/40">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                        <input
                          type="text"
                          value={ruleDraft.pattern}
                          onChange={(e) =>
                            setRuleDraft((d) => (d ? { ...d, pattern: e.target.value } : d))
                          }
                          className="rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
                        />
                        <select
                          value={ruleDraft.matchType}
                          onChange={(e) =>
                            setRuleDraft((d) =>
                              d ? { ...d, matchType: e.target.value as RuleMatchType } : d
                            )
                          }
                          className="rounded-lg border border-[#CBD5E1] bg-white px-2 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
                        >
                          <option value="contains">{matchTypeLabel('contains')}</option>
                          <option value="startsWith">{matchTypeLabel('startsWith')}</option>
                          <option value="exact">{matchTypeLabel('exact')}</option>
                        </select>
                        <select
                          value={ruleDraft.categoryId}
                          onChange={(e) =>
                            setRuleDraft((d) => (d ? { ...d, categoryId: e.target.value } : d))
                          }
                          className="rounded-lg border border-[#CBD5E1] bg-white px-2 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
                        >
                          {state.categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.icon} {catName(c)}
                            </option>
                          ))}
                        </select>
                        <select
                          value={ruleDraft.memberId}
                          onChange={(e) =>
                            setRuleDraft((d) => (d ? { ...d, memberId: e.target.value } : d))
                          }
                          className="rounded-lg border border-[#CBD5E1] bg-white px-2 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
                        >
                          <option value="">{t('auto.keepMember')}</option>
                          {state.members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.avatar} {memName(m)}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={ruleDraft.tagsText}
                          onChange={(e) =>
                            setRuleDraft((d) => (d ? { ...d, tagsText: e.target.value } : d))
                          }
                          placeholder={t('auto.tagsPlaceholder')}
                          className="rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs dark:border-[#2f3b52] dark:bg-[#172036]"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRuleId(null);
                            setRuleDraft(null);
                          }}
                          className="rounded-lg border border-[#bfc9c3]/60 bg-white px-3 py-1 text-xs font-semibold text-[#404944] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-[#bfc9c3]"
                        >
                          {t('layout.cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveRuleEdit(rule)}
                          className="rounded-lg bg-[#064E3B] px-3 py-1 text-xs font-semibold text-white hover:bg-[#043D2E]"
                        >
                          {t('common.save')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded bg-[#eaedff] px-2 py-0.5 font-semibold uppercase text-[#404944] dark:bg-[#172036] dark:text-[#bfc9c3]">
                            {matchTypeLabel(rule.matchType)}
                          </span>
                          <span className="text-sm font-bold text-[#131b2e] dark:text-white">
                            &ldquo;{rule.pattern}&rdquo;
                          </span>
                          <span className="text-[#707974]">→</span>
                          <span className="font-semibold text-[#0F766E] dark:text-[#6ac0b6]">
                            {cat?.icon} {catName(cat)}
                          </span>
                          {mem && (
                            <span className="rounded bg-[#eaedff]/70 px-2 py-0.5 text-[11px] font-semibold text-[#004d47] dark:bg-violet-950/40 dark:text-[#9cf2e8]">
                              {mem.avatar} {memName(mem)}
                            </span>
                          )}
                          {rule.tags?.map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-[#eaedff] px-1.5 py-0.5 text-[10px] dark:bg-[#172036]"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEditRule(rule)}
                          className="rounded-lg p-1.5 text-[#707974] hover:bg-[#eaedff] hover:text-[#0F766E] dark:hover:bg-[#1c2640]"
                          aria-label={t('auto.editRuleAria', { pattern: rule.pattern })}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => upsertRule({ ...rule, isActive: !rule.isActive })}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#bfc9c3]/60 px-2.5 py-1 text-xs font-semibold text-[#404944] hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:text-[#bfc9c3] dark:hover:bg-[#1c2640]"
                        >
                          {rule.isActive ? (
                            <>
                              <Pause className="h-3 w-3" /> {t('bills.pause')}
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3" /> {t('bills.resume')}
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRule(rule.id)}
                          className="rounded-lg p-1.5 text-[#707974] hover:text-[#ba1a1a]"
                          aria-label={t('auto.deleteRuleAria', { pattern: rule.pattern })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
