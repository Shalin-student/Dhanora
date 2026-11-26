import type { CurrencyCode } from '../types/finance';

export const CURRENCY_META: Record<
  CurrencyCode,
  { symbol: string; name: string; decimals: number; defaultRateToUsd: number }
> = {
  USD: { symbol: '$', name: 'US Dollar', decimals: 2, defaultRateToUsd: 1 },
  EUR: { symbol: '€', name: 'Euro', decimals: 2, defaultRateToUsd: 0.92 },
  GBP: { symbol: '£', name: 'British Pound', decimals: 2, defaultRateToUsd: 0.79 },
  INR: { symbol: '₹', name: 'Indian Rupee', decimals: 0, defaultRateToUsd: 84.5 },
  CAD: { symbol: 'CA$', name: 'Canadian Dollar', decimals: 2, defaultRateToUsd: 1.39 },
  AUD: { symbol: 'A$', name: 'Australian Dollar', decimals: 2, defaultRateToUsd: 1.53 },
  JPY: { symbol: '¥', name: 'Japanese Yen', decimals: 0, defaultRateToUsd: 154 },
};

export const DEFAULT_EXCHANGE_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  INR: 84.5,
  CAD: 1.39,
  AUD: 1.53,
  JPY: 154,
};

/**
 * Converts an amount from sourceCurrency to targetCurrency using rates anchored to USD.
 */
export function convertCurrency(
  amount: number,
  sourceCurrency: CurrencyCode,
  targetCurrency: CurrencyCode,
  rates: Record<CurrencyCode, number>
): number {
  if (sourceCurrency === targetCurrency) return amount;
  const fromRate = rates[sourceCurrency] || 1;
  const toRate = rates[targetCurrency] || 1;
  const inUsd = amount / fromRate;
  return Number((inUsd * toRate).toFixed(2));
}

export function formatMoney(
  amount: number,
  currency: CurrencyCode = 'USD',
  privacyMode = false,
  compact = false
): string {
  if (privacyMode) {
    return `${CURRENCY_META[currency]?.symbol ?? '$'}••••`;
  }
  const meta = CURRENCY_META[currency] ?? CURRENCY_META.USD;
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';

  if (compact && abs >= 1000) {
    const formatted = new Intl.NumberFormat(locale, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(abs);
    return `${sign}${meta.symbol}${formatted}`;
  }

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: meta.decimals === 0 ? 0 : 2,
    maximumFractionDigits: meta.decimals,
  }).format(abs);
  return `${sign}${meta.symbol}${formatted}`;
}
