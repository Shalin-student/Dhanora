import type { AppSettings, AppState, CurrencyCode, PlanTier } from '../types/finance';

export const FREE_TIER_LIMITS = {
  maxMembers: 4,
  maxGoals: 3,
} as const;

export function getEffectivePlanTier(settings?: Pick<AppSettings, 'planTier' | 'trialEndsAt'>): PlanTier {
  const tier = settings?.planTier ?? 'free';
  return tier;
}

export function canCreateGoal(state: AppState): {
  allowed: boolean;
  tier: PlanTier;
  current: number;
  limit: number | null;
} {
  const tier = getEffectivePlanTier(state.settings);
  const current = state.goals.length;
  if (tier === 'plus' || tier === 'advisor') {
    return { allowed: true, tier, current, limit: null };
  }
  return {
    allowed: current < FREE_TIER_LIMITS.maxGoals,
    tier,
    current,
    limit: FREE_TIER_LIMITS.maxGoals,
  };
}

export function canCreateMember(state: AppState): {
  allowed: boolean;
  tier: PlanTier;
  current: number;
  limit: number | null;
} {
  const tier = getEffectivePlanTier(state.settings);
  const current = state.members.filter((m) => m.role !== 'shared').length;
  if (tier === 'plus' || tier === 'advisor') {
    return { allowed: true, tier, current, limit: null };
  }
  return {
    allowed: current < FREE_TIER_LIMITS.maxMembers,
    tier,
    current,
    limit: FREE_TIER_LIMITS.maxMembers,
  };
}

export function formatInvoiceMinorAmount(amountMinor: number, currency: CurrencyCode | string): string {
  const major = amountMinor / 100;
  if (currency === 'INR') {
    return `₹${major.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }
  return `$${major.toLocaleString('en-US', {
    minimumFractionDigits: major % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
