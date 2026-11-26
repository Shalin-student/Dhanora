import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  Pause,
  Play,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import type { AssetClass, CurrencyCode, InvestmentHolding, SipPlan } from '../types/finance';
import { CURRENCY_META, formatMoney } from '../utils/currency';
import {
  ASSET_CLASS_META,
  computePortfolioSummary,
  computeWealthProjection,
} from '../utils/portfolio';
import { CategoryDonutChart, WealthProjectionChart } from './Charts';
import { useI18n } from '../i18n/useI18n';

const ASSET_CLASSES: AssetClass[] = [
  'equity',
  'mutual_fund',
  'fixed_deposit',
  'gold',
  'bond',
  'other',
];

export const InvestmentPortfolioSection: React.FC = () => {
  const {
    state,
    upsertInvestment,
    deleteInvestment,
    upsertSip,
    deleteSip,
    recordSipInstallment,
  } = useFinance();
  const { baseCurrency, privacyMode } = state.settings;
  const { language, t, accName, entityText, assetClassLabel } = useI18n();

  const summary = useMemo(() => computePortfolioSummary(state), [state]);

  // Add Holding Form state
  const defaultInvestAcc =
    state.accounts.find((a) => a.type === 'investment')?.id ?? state.accounts[0]?.id ?? '';
  const [symbol, setSymbol] = useState('');
  const [holdingName, setHoldingName] = useState('');
  const [assetClass, setAssetClass] = useState<AssetClass>('equity');
  const [units, setUnits] = useState('10');
  const [avgCost, setAvgCost] = useState('100');
  const [currentPrice, setCurrentPrice] = useState('112');
  const [holdingCurrency, setHoldingCurrency] = useState<CurrencyCode>(baseCurrency);

  // Inline Edit Holding state
  const [editingHoldingId, setEditingHoldingId] = useState<string | null>(null);
  const [holdingDraft, setHoldingDraft] = useState<{
    symbol: string;
    name: string;
    assetClass: AssetClass;
    units: string;
    avgCost: string;
    currentPrice: string;
    apr: string;
  } | null>(null);

  // Add SIP Form state
  const [sipName, setSipName] = useState('');
  const [sipAmount, setSipAmount] = useState('300');
  const [sipApr, setSipApr] = useState('10.5');
  const [sipFromAcc, setSipFromAcc] = useState(state.accounts[0]?.id ?? '');
  const [sipHoldingId, setSipHoldingId] = useState('');

  // Inline Edit SIP state
  const [editingSipId, setEditingSipId] = useState<string | null>(null);
  const [sipDraft, setSipDraft] = useState<{
    name: string;
    monthlyAmount: string;
    expectedAnnualReturnPct: string;
    dayOfMonth: string;
  } | null>(null);

  // Interactive Compound Projection Sliders
  const [projYears, setProjYears] = useState(10);
  const [projSipOverride, setProjSipOverride] = useState<number | null>(null);
  const [projCagrOverride, setProjCagrOverride] = useState<number | null>(null);
  const [projStepUpPct, setProjStepUpPct] = useState(5);

  const effectiveMonthlySip = projSipOverride ?? summary.activeMonthlySip;
  const effectiveCagr = projCagrOverride ?? summary.weightedExpectedReturnPct;

  const projection = useMemo(
    () =>
      computeWealthProjection({
        startingCorpus: summary.totalCurrentValue,
        monthlySip: effectiveMonthlySip,
        annualReturnPct: effectiveCagr,
        stepUpPct: projStepUpPct,
        years: projYears,
        language,
      }),
    [summary.totalCurrentValue, effectiveMonthlySip, effectiveCagr, projStepUpPct, projYears, language]
  );

  const allocationSlices = summary.allocation.map((item) => ({
    id: item.assetClass,
    label: assetClassLabel(item.assetClass),
    value: item.value,
    color: item.color,
  }));

  const handleAddHolding = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedUnits = parseFloat(units);
    const parsedAvg = parseFloat(avgCost);
    const parsedCur = parseFloat(currentPrice);
    if (
      !symbol.trim() ||
      !holdingName.trim() ||
      Number.isNaN(parsedUnits) ||
      parsedUnits <= 0 ||
      Number.isNaN(parsedCur) ||
      parsedCur < 0
    ) {
      return;
    }
    upsertInvestment({
      id: `inv-${Date.now()}`,
      symbol: symbol.trim().toUpperCase(),
      name: holdingName.trim(),
      assetClass,
      accountId: defaultInvestAcc,
      units: parsedUnits,
      avgCostPerUnit: Number.isNaN(parsedAvg) ? parsedCur : parsedAvg,
      currentPricePerUnit: parsedCur,
      currency: holdingCurrency,
      expectedAnnualReturnPct: ASSET_CLASS_META[assetClass].defaultApr,
      ownerId: state.members[0]?.id ?? 'm-shared',
    });
    setSymbol('');
    setHoldingName('');
  };

  const startEditHolding = (h: InvestmentHolding) => {
    setEditingHoldingId(h.id);
    setHoldingDraft({
      symbol: h.symbol,
      name: h.name,
      assetClass: h.assetClass,
      units: String(h.units),
      avgCost: String(h.avgCostPerUnit),
      currentPrice: String(h.currentPricePerUnit),
      apr: String(h.expectedAnnualReturnPct ?? ASSET_CLASS_META[h.assetClass].defaultApr),
    });
  };

  const saveEditHolding = (h: InvestmentHolding) => {
    if (!holdingDraft || !holdingDraft.name.trim()) return;
    upsertInvestment({
      ...h,
      symbol: holdingDraft.symbol.trim().toUpperCase() || h.symbol,
      name: holdingDraft.name.trim(),
      assetClass: holdingDraft.assetClass,
      units: Math.max(0, parseFloat(holdingDraft.units) || 0),
      avgCostPerUnit: Math.max(0, parseFloat(holdingDraft.avgCost) || 0),
      currentPricePerUnit: Math.max(0, parseFloat(holdingDraft.currentPrice) || 0),
      expectedAnnualReturnPct: parseFloat(holdingDraft.apr) || 0,
    });
    setEditingHoldingId(null);
    setHoldingDraft(null);
  };

  const handleAddSip = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(sipAmount);
    if (!sipName.trim() || Number.isNaN(amt) || amt <= 0) return;
    upsertSip({
      id: `sip-${Date.now()}`,
      name: sipName.trim(),
      holdingId: sipHoldingId || undefined,
      accountId: sipFromAcc,
      targetAccountId: defaultInvestAcc || undefined,
      memberId: state.members[0]?.id ?? 'm-shared',
      monthlyAmount: amt,
      expectedAnnualReturnPct: parseFloat(sipApr) || 10,
      dayOfMonth: 5,
      isActive: true,
    });
    setSipName('');
  };

  const startEditSip = (sip: SipPlan) => {
    setEditingSipId(sip.id);
    setSipDraft({
      name: sip.name,
      monthlyAmount: String(sip.monthlyAmount),
      expectedAnnualReturnPct: String(sip.expectedAnnualReturnPct),
      dayOfMonth: String(sip.dayOfMonth),
    });
  };

  const saveEditSip = (sip: SipPlan) => {
    if (!sipDraft || !sipDraft.name.trim()) return;
    const amt = parseFloat(sipDraft.monthlyAmount);
    if (Number.isNaN(amt) || amt <= 0) return;
    upsertSip({
      ...sip,
      name: sipDraft.name.trim(),
      monthlyAmount: amt,
      expectedAnnualReturnPct: parseFloat(sipDraft.expectedAnnualReturnPct) || 0,
      dayOfMonth: Math.max(1, Math.min(28, parseInt(sipDraft.dayOfMonth, 10) || sip.dayOfMonth)),
    });
    setEditingSipId(null);
    setSipDraft(null);
  };

  return (
    <section className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-600" />
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {t('inv.sectionTitle')}
          </h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('inv.sectionSub')}</p>
      </div>

      {/* Portfolio KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-[11px] font-semibold uppercase text-slate-500">
            {t('inv.portfolioValue')}
          </div>
          <div className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">
            {formatMoney(summary.totalCurrentValue, baseCurrency, privacyMode)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-[11px] font-semibold uppercase text-slate-500">
            {t('inv.investedCost')}
          </div>
          <div className="mt-1 text-xl font-extrabold text-slate-700 dark:text-slate-200">
            {formatMoney(summary.totalInvested, baseCurrency, privacyMode)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-[11px] font-semibold uppercase text-slate-500">
            {t('inv.unrealizedGain')}
          </div>
          <div
            className={`mt-1 text-xl font-extrabold ${
              summary.totalGain >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {summary.totalGain >= 0 ? '+' : ''}
            {formatMoney(summary.totalGain, baseCurrency, privacyMode)}{' '}
            <span className="text-xs font-bold">
              ({summary.totalGain >= 0 ? '+' : ''}
              {summary.totalGainPct}%)
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">
            {t('inv.monthlySip')}
          </div>
          <div className="mt-1 text-xl font-extrabold text-emerald-700 dark:text-emerald-300">
            {formatMoney(summary.activeMonthlySip, baseCurrency, privacyMode)}
          </div>
        </div>
      </div>

      {/* Allocation Donut + Holdings List */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 lg:col-span-5">
          <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">
            {t('inv.allocationTitle')}
          </h3>
          <CategoryDonutChart
            slices={allocationSlices}
            currency={baseCurrency}
            privacyMode={privacyMode}
            centerLabel={t('inv.portfolioValue')}
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
          <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
            {t('inv.holdingsTitle')}
          </h3>
          {summary.holdings.length === 0 ? (
            <p className="text-xs text-slate-500">{t('inv.noHoldings')}</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {summary.holdings.map(
                ({ holding, currentValueBase, unrealizedGainBase, returnPct }) => {
                  const isEditing = editingHoldingId === holding.id && holdingDraft;
                  return (
                    <div key={holding.id} className="py-3">
                      {isEditing ? (
                        <div className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            <input
                              type="text"
                              value={holdingDraft.symbol}
                              onChange={(e) =>
                                setHoldingDraft((d) => (d ? { ...d, symbol: e.target.value } : d))
                              }
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                            />
                            <input
                              type="text"
                              value={holdingDraft.name}
                              onChange={(e) =>
                                setHoldingDraft((d) => (d ? { ...d, name: e.target.value } : d))
                              }
                              className="col-span-2 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                            />
                            <select
                              value={holdingDraft.assetClass}
                              onChange={(e) =>
                                setHoldingDraft((d) =>
                                  d ? { ...d, assetClass: e.target.value as AssetClass } : d
                                )
                              }
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                            >
                              {ASSET_CLASSES.map((ac) => (
                                <option key={ac} value={ac}>
                                  {assetClassLabel(ac)}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              step="0.01"
                              value={holdingDraft.units}
                              onChange={(e) =>
                                setHoldingDraft((d) => (d ? { ...d, units: e.target.value } : d))
                              }
                              placeholder={t('inv.unitsPlaceholder')}
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                            />
                            <input
                              type="number"
                              step="0.01"
                              value={holdingDraft.currentPrice}
                              onChange={(e) =>
                                setHoldingDraft((d) =>
                                  d ? { ...d, currentPrice: e.target.value } : d
                                )
                              }
                              placeholder={t('inv.curPricePlaceholder')}
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingHoldingId(null);
                                setHoldingDraft(null);
                              }}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                            >
                              {t('layout.cancel')}
                            </button>
                            <button
                              type="button"
                              onClick={() => saveEditHolding(holding)}
                              className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                            >
                              {t('common.save')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                              <span
                                className="rounded px-1.5 py-0.5 text-[10px] font-extrabold text-white"
                                style={{ backgroundColor: ASSET_CLASS_META[holding.assetClass].color }}
                              >
                                {holding.symbol}
                              </span>
                              <span>{entityText(holding.name)}</span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500">
                              {assetClassLabel(holding.assetClass)} •{' '}
                              {t('inv.unitsLine', {
                                units: holding.units,
                                avg: formatMoney(
                                  holding.avgCostPerUnit,
                                  holding.currency,
                                  privacyMode
                                ),
                                price: formatMoney(
                                  holding.currentPricePerUnit,
                                  holding.currency,
                                  privacyMode
                                ),
                              })}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                                {formatMoney(currentValueBase, baseCurrency, privacyMode)}
                              </div>
                              <div
                                className={`text-[11px] font-semibold ${
                                  unrealizedGainBase >= 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {unrealizedGainBase >= 0 ? '+' : ''}
                                {formatMoney(unrealizedGainBase, baseCurrency, privacyMode)} (
                                {unrealizedGainBase >= 0 ? '+' : ''}
                                {returnPct}%)
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => startEditHolding(holding)}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
                              aria-label={t('inv.editHoldingAria', { name: holding.name })}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteInvestment(holding.id)}
                              className="rounded p-1 text-slate-400 hover:text-rose-500"
                              aria-label={t('inv.deleteHoldingAria', { name: holding.name })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}

          {/* Add Holding Form */}
          <form
            onSubmit={handleAddHolding}
            className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-4 dark:border-slate-800"
          >
            <input
              type="text"
              required
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder={t('inv.symbolPlaceholder')}
              className="rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              type="text"
              required
              value={holdingName}
              onChange={(e) => setHoldingName(e.target.value)}
              placeholder={t('inv.namePlaceholder')}
              className="col-span-2 rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <select
              value={assetClass}
              onChange={(e) => setAssetClass(e.target.value as AssetClass)}
              className="rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              {ASSET_CLASSES.map((ac) => (
                <option key={ac} value={ac}>
                  {assetClassLabel(ac)}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              placeholder={t('inv.unitsPlaceholder')}
              className="rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
              placeholder={t('inv.avgCostPlaceholder')}
              className="rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={currentPrice}
              onChange={(e) => setCurrentPrice(e.target.value)}
              placeholder={t('inv.curPricePlaceholder')}
              className="rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <div className="flex gap-1.5">
              <select
                value={holdingCurrency}
                onChange={(e) => setHoldingCurrency(e.target.value as CurrencyCode)}
                className="w-20 rounded-xl border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                {Object.keys(CURRENCY_META).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Plus className="h-3.5 w-3.5" />
                {t('inv.addHoldingBtn')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Systematic Investment Plans (SIP Tracker) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {t('sip.sectionTitle')}
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(state.sips ?? []).map((sip) => {
            const fromAcc = state.accounts.find((a) => a.id === sip.accountId);
            const toAcc = state.accounts.find((a) => a.id === sip.targetAccountId);
            const isEditing = editingSipId === sip.id && sipDraft;

            return (
              <div
                key={sip.id}
                className={`rounded-xl border p-4 ${
                  sip.isActive
                    ? 'border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/50'
                    : 'border-slate-200/70 bg-slate-50/40 opacity-65 dark:border-slate-800'
                }`}
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={sipDraft.name}
                        onChange={(e) =>
                          setSipDraft((d) => (d ? { ...d, name: e.target.value } : d))
                        }
                        className="col-span-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                      />
                      <input
                        type="number"
                        min="1"
                        value={sipDraft.monthlyAmount}
                        onChange={(e) =>
                          setSipDraft((d) => (d ? { ...d, monthlyAmount: e.target.value } : d))
                        }
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={sipDraft.expectedAnnualReturnPct}
                        onChange={(e) =>
                          setSipDraft((d) =>
                            d ? { ...d, expectedAnnualReturnPct: e.target.value } : d
                          )
                        }
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSipId(null);
                          setSipDraft(null);
                        }}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                      >
                        {t('layout.cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEditSip(sip)}
                        className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        {t('common.save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          {entityText(sip.name)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {t('sip.lineMeta', {
                            day: sip.dayOfMonth,
                            fromAcc: accName(fromAcc),
                            toAcc: accName(toAcc),
                            apr: sip.expectedAnnualReturnPct,
                          })}
                        </div>
                      </div>
                      <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                        {formatMoney(sip.monthlyAmount, fromAcc?.currency ?? baseCurrency, privacyMode)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-2.5 dark:border-slate-700">
                      <span className="text-[11px] text-slate-500">
                        {sip.lastInvestedDate
                          ? t('sip.lastInvested', { date: sip.lastInvestedDate })
                          : t('sip.notInvestedYet')}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEditSip(sip)}
                          className="rounded p-1 text-slate-400 hover:bg-white hover:text-blue-600 dark:hover:bg-slate-800"
                          aria-label={t('sip.editAria', { name: sip.name })}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => upsertSip({ ...sip, isActive: !sip.isActive })}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          {sip.isActive ? (
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
                          onClick={() => recordSipInstallment(sip.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {t('sip.investNow')}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSip(sip.id)}
                          className="rounded p-1 text-slate-400 hover:text-rose-500"
                          aria-label={t('sip.deleteAria', { name: sip.name })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Add SIP Form */}
        <form
          onSubmit={handleAddSip}
          className="mt-4 grid grid-cols-1 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-7 dark:border-slate-800"
        >
          <input
            type="text"
            required
            value={sipName}
            onChange={(e) => setSipName(e.target.value)}
            placeholder={t('sip.namePlaceholder')}
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs sm:col-span-2 dark:border-slate-700 dark:bg-slate-800"
          />
          <input
            type="number"
            min="1"
            required
            value={sipAmount}
            onChange={(e) => setSipAmount(e.target.value)}
            placeholder={t('sip.monthlyAmtPlaceholder')}
            className="rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
          <input
            type="number"
            step="0.1"
            value={sipApr}
            onChange={(e) => setSipApr(e.target.value)}
            placeholder={t('sip.aprPlaceholder')}
            className="rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
          <select
            value={sipFromAcc}
            onChange={(e) => setSipFromAcc(e.target.value)}
            className="rounded-xl border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            {state.accounts
              .filter((a) => !a.isArchived)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {accName(a)}
                </option>
              ))}
          </select>
          <select
            value={sipHoldingId}
            onChange={(e) => setSipHoldingId(e.target.value)}
            className="rounded-xl border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="">{t('sip.noHoldingLink')}</option>
            {(state.investments ?? []).map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.symbol} — {entityText(inv.name)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('sip.addSipBtn')}
          </button>
        </form>
      </div>

      {/* Long-Term Compound Wealth Projection Simulator */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('proj.title')}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('proj.subtitle')}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-right">
            <div>
              <div className="text-[11px] text-slate-500">
                {t('proj.finalCorpus', { y: projYears })}
              </div>
              <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatMoney(projection.finalValue, baseCurrency, privacyMode)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">{t('proj.totalInvested')}</div>
              <div className="text-base font-extrabold text-slate-800 dark:text-slate-200">
                {formatMoney(projection.totalContributed, baseCurrency, privacyMode)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">{t('proj.estGains')}</div>
              <div className="text-base font-extrabold text-blue-600 dark:text-blue-400">
                +{formatMoney(projection.totalGains, baseCurrency, privacyMode)}{' '}
                <span className="text-[11px]">
                  ({t('proj.multiple', { m: projection.wealthMultiple })})
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-4 rounded-xl bg-slate-50 p-3.5 sm:grid-cols-2 lg:grid-cols-4 dark:bg-slate-800/60">
          <div>
            <label htmlFor="proj-years-slider" className="mb-1 block text-xs font-semibold">
              {t('proj.yearsLabel', { y: projYears })}
            </label>
            <input
              id="proj-years-slider"
              type="range"
              min={3}
              max={20}
              step={1}
              value={projYears}
              onChange={(e) => setProjYears(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>
          <div>
            <label htmlFor="proj-sip-slider" className="mb-1 block text-xs font-semibold">
              {t('proj.sipSliderLabel')}{' '}
              {formatMoney(effectiveMonthlySip, baseCurrency, privacyMode)}
            </label>
            <input
              id="proj-sip-slider"
              type="range"
              min={0}
              max={5000}
              step={50}
              value={effectiveMonthlySip}
              onChange={(e) => setProjSipOverride(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>
          <div>
            <label htmlFor="proj-cagr-slider" className="mb-1 block text-xs font-semibold">
              {t('proj.cagrLabel', { r: effectiveCagr })}
            </label>
            <input
              id="proj-cagr-slider"
              type="range"
              min={4}
              max={18}
              step={0.5}
              value={effectiveCagr}
              onChange={(e) => setProjCagrOverride(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>
          <div>
            <label htmlFor="proj-stepup-slider" className="mb-1 block text-xs font-semibold">
              {t('proj.stepUpLabel', { s: projStepUpPct })}
            </label>
            <input
              id="proj-stepup-slider"
              type="range"
              min={0}
              max={15}
              step={1}
              value={projStepUpPct}
              onChange={(e) => setProjStepUpPct(Number(e.target.value))}
              className="w-full accent-violet-600"
            />
          </div>
        </div>

        <WealthProjectionChart
          points={projection.points}
          currency={baseCurrency}
          privacyMode={privacyMode}
        />
      </div>
    </section>
  );
};
