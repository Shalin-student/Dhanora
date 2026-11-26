import type {
  AppLanguage,
  AppState,
  AssetClass,
  CurrencyCode,
  InvestmentHolding,
} from '../types/finance';
import { convertCurrency } from './currency';

export const ASSET_CLASS_META: Record<AssetClass, { color: string; defaultApr: number }> = {
  equity: { color: '#2563eb', defaultApr: 10.5 },
  mutual_fund: { color: '#10b981', defaultApr: 9.5 },
  fixed_deposit: { color: '#0ea5e9', defaultApr: 7.0 },
  gold: { color: '#f59e0b', defaultApr: 7.5 },
  bond: { color: '#8b5cf6', defaultApr: 6.5 },
  other: { color: '#64748b', defaultApr: 8.0 },
};

export interface HoldingValuation {
  holding: InvestmentHolding;
  investedValueBase: number;
  currentValueBase: number;
  unrealizedGainBase: number;
  returnPct: number;
}

export interface PortfolioAllocationItem {
  assetClass: AssetClass;
  value: number;
  percentage: number;
  color: string;
  count: number;
}

export interface PortfolioSummary {
  holdings: HoldingValuation[];
  totalInvested: number;
  totalCurrentValue: number;
  totalGain: number;
  totalGainPct: number;
  activeMonthlySip: number;
  weightedExpectedReturnPct: number;
  allocation: PortfolioAllocationItem[];
}

export function computeHoldingValuation(
  holding: InvestmentHolding,
  baseCurrency: CurrencyCode,
  exchangeRates: Record<CurrencyCode, number>
): HoldingValuation {
  const investedRaw = holding.units * holding.avgCostPerUnit;
  const currentRaw = holding.units * holding.currentPricePerUnit;
  const investedValueBase = convertCurrency(
    investedRaw,
    holding.currency,
    baseCurrency,
    exchangeRates
  );
  const currentValueBase = convertCurrency(
    currentRaw,
    holding.currency,
    baseCurrency,
    exchangeRates
  );
  const unrealizedGainBase = Number((currentValueBase - investedValueBase).toFixed(2));
  const returnPct =
    investedValueBase > 0
      ? Number(((unrealizedGainBase / investedValueBase) * 100).toFixed(1))
      : 0;

  return {
    holding,
    investedValueBase,
    currentValueBase,
    unrealizedGainBase,
    returnPct,
  };
}

export function computePortfolioSummary(state: AppState): PortfolioSummary {
  const { baseCurrency, exchangeRates } = state.settings;
  const holdings = (state.investments ?? []).map((h) =>
    computeHoldingValuation(h, baseCurrency, exchangeRates)
  );

  const totalInvested = Number(
    holdings.reduce((s, item) => s + item.investedValueBase, 0).toFixed(2)
  );
  const totalCurrentValue = Number(
    holdings.reduce((s, item) => s + item.currentValueBase, 0).toFixed(2)
  );
  const totalGain = Number((totalCurrentValue - totalInvested).toFixed(2));
  const totalGainPct =
    totalInvested > 0 ? Number(((totalGain / totalInvested) * 100).toFixed(1)) : 0;

  let weightedReturnSum = 0;
  const classBuckets = new Map<AssetClass, { value: number; count: number }>();

  for (const item of holdings) {
    const apr =
      item.holding.expectedAnnualReturnPct ??
      ASSET_CLASS_META[item.holding.assetClass].defaultApr;
    weightedReturnSum += item.currentValueBase * apr;

    const existing = classBuckets.get(item.holding.assetClass) ?? { value: 0, count: 0 };
    existing.value += item.currentValueBase;
    existing.count += 1;
    classBuckets.set(item.holding.assetClass, existing);
  }

  const weightedExpectedReturnPct =
    totalCurrentValue > 0 ? Number((weightedReturnSum / totalCurrentValue).toFixed(1)) : 9.0;

  const allocation: PortfolioAllocationItem[] = Array.from(classBuckets.entries())
    .map(([assetClass, info]) => ({
      assetClass,
      value: Number(info.value.toFixed(2)),
      percentage:
        totalCurrentValue > 0 ? Number(((info.value / totalCurrentValue) * 100).toFixed(1)) : 0,
      color: ASSET_CLASS_META[assetClass].color,
      count: info.count,
    }))
    .sort((a, b) => b.value - a.value);

  const activeMonthlySip = Number(
    (state.sips ?? [])
      .filter((s) => s.isActive)
      .reduce((sum, s) => sum + s.monthlyAmount, 0)
      .toFixed(2)
  );

  return {
    holdings,
    totalInvested,
    totalCurrentValue,
    totalGain,
    totalGainPct,
    activeMonthlySip,
    weightedExpectedReturnPct,
    allocation,
  };
}

export interface WealthProjectionPoint {
  year: number;
  label: string;
  contributedCapital: number;
  projectedValue: number;
  estimatedGains: number;
}

export interface WealthProjectionResult {
  points: WealthProjectionPoint[];
  finalValue: number;
  totalContributed: number;
  totalGains: number;
  wealthMultiple: number;
}

/**
 * Projects long-term compound wealth growth over `years` using monthly compounding
 * and optional annual SIP step-up percentage.
 */
export function computeWealthProjection(options: {
  startingCorpus: number;
  monthlySip: number;
  annualReturnPct: number;
  stepUpPct?: number;
  years?: number;
  language?: AppLanguage;
}): WealthProjectionResult {
  const years = Math.max(1, Math.min(30, Math.round(options.years ?? 10)));
  const startingCorpus = Math.max(0, options.startingCorpus || 0);
  let monthlySip = Math.max(0, options.monthlySip || 0);
  const annualRate = Math.max(0, options.annualReturnPct || 0) / 100;
  const monthlyRate = annualRate / 12;
  const stepUpFactor = 1 + Math.max(0, options.stepUpPct ?? 0) / 100;
  const lang = options.language ?? 'en';

  const makeLabel = (yr: number) => (lang === 'gu' ? `વર્ષ ${yr}` : `Y${yr}`);

  let balance = startingCorpus;
  let contributed = startingCorpus;

  const points: WealthProjectionPoint[] = [
    {
      year: 0,
      label: makeLabel(0),
      contributedCapital: Number(contributed.toFixed(2)),
      projectedValue: Number(balance.toFixed(2)),
      estimatedGains: 0,
    },
  ];

  for (let yr = 1; yr <= years; yr++) {
    for (let mo = 0; mo < 12; mo++) {
      balance = balance * (1 + monthlyRate) + monthlySip;
      contributed += monthlySip;
    }
    const roundedBalance = Number(balance.toFixed(2));
    const roundedContributed = Number(contributed.toFixed(2));
    points.push({
      year: yr,
      label: makeLabel(yr),
      contributedCapital: roundedContributed,
      projectedValue: roundedBalance,
      estimatedGains: Number((roundedBalance - roundedContributed).toFixed(2)),
    });
    monthlySip *= stepUpFactor;
  }

  const finalPoint = points[points.length - 1];
  const wealthMultiple =
    finalPoint.contributedCapital > 0
      ? Number((finalPoint.projectedValue / finalPoint.contributedCapital).toFixed(2))
      : 1;

  return {
    points,
    finalValue: finalPoint.projectedValue,
    totalContributed: finalPoint.contributedCapital,
    totalGains: finalPoint.estimatedGains,
    wealthMultiple,
  };
}
