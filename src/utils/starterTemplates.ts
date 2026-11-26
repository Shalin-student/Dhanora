import type { AppState } from '../types/finance';
import { shiftMonth, todayISO } from './calculations';

export type StarterTemplateId = 'salaried' | 'couple' | 'student' | 'blank';

export function buildStarterTemplateState(
  current: AppState,
  templateId: StarterTemplateId,
  ownerMemberId: string
): AppState {
  const baseSettings = {
    ...current.settings,
    onboardingDismissed: true,
  };

  if (templateId === 'blank') {
    return {
      ...current,
      settings: baseSettings,
    };
  }

  const isInr = current.settings.baseCurrency === 'INR';
  const cur = current.settings.baseCurrency;
  const today = todayISO();
  const month = today.slice(0, 7);
  const scale = isInr ? 1 : 0.05;
  const amt = (inrVal: number) =>
    isInr ? inrVal : Math.max(10, Math.round(inrVal * scale));

  const primaryAcc = current.accounts[0] ?? {
    id: `acc-primary-${Date.now().toString(36)}`,
    name: isInr ? 'HDFC Savings Account' : 'Primary Checking',
    type: 'checking' as const,
    ownerId: ownerMemberId,
    initialBalance: 0,
    institution: isInr ? 'HDFC Bank' : 'Primary Bank',
    color: '#2563eb',
    currency: cur,
  };

  const updatedPrimary = {
    ...primaryAcc,
    name: isInr ? 'Primary Bank Account' : primaryAcc.name,
    initialBalance: amt(templateId === 'student' ? 18000 : 145000),
    nomineeName: templateId === 'couple' ? 'Partner' : primaryAcc.nomineeName,
  };

  const nowIso = `${today}T09:00:00Z`;
  const partnerId = `m-partner-${Date.now().toString(36)}`;

  if (templateId === 'salaried') {
    return {
      ...current,
      settings: baseSettings,
      accounts: [updatedPrimary],
      transactions: [
        {
          id: `tx-tpl-1-${Date.now()}`,
          type: 'income',
          amount: amt(92000),
          currency: cur,
          baseAmount: amt(92000),
          date: `${month}-01`,
          merchant: 'Monthly Salary Credit',
          categoryId: 'cat-salary',
          accountId: updatedPrimary.id,
          memberId: ownerMemberId,
          tags: ['salary'],
          note: 'Template starting salary',
          status: 'cleared',
          createdAt: nowIso,
        },
        {
          id: `tx-tpl-2-${Date.now()}`,
          type: 'expense',
          amount: amt(22000),
          currency: cur,
          baseAmount: amt(22000),
          date: `${month}-03`,
          merchant: 'Home Rent & Maintenance',
          categoryId: 'cat-housing',
          accountId: updatedPrimary.id,
          memberId: 'm-shared',
          tags: ['housing'],
          note: 'Monthly rent',
          status: 'cleared',
          createdAt: nowIso,
        },
        {
          id: `tx-tpl-3-${Date.now()}`,
          type: 'expense',
          amount: amt(8400),
          currency: cur,
          baseAmount: amt(8400),
          date: today,
          merchant: 'Monthly Groceries & Produce',
          categoryId: 'cat-groceries',
          accountId: updatedPrimary.id,
          memberId: 'm-shared',
          tags: ['groceries'],
          note: 'Household food envelope',
          status: 'cleared',
          createdAt: nowIso,
        },
      ],
      goals: [
        {
          id: `goal-tpl-1-${Date.now()}`,
          name: '6-Month Emergency Reserve',
          targetAmount: amt(300000),
          currentAmount: amt(145000),
          targetDate: `${shiftMonth(month, 12)}-01`,
          category: 'emergency',
          linkedAccountId: updatedPrimary.id,
          ownerId: 'm-shared',
          priority: 'high',
          color: '#059669',
          icon: '🛡️',
        },
      ],
      policies: [
        {
          id: `pol-tpl-1-${Date.now()}`,
          name: 'Family Term Life Cover',
          insurer: 'HDFC Life / LIC',
          type: 'term',
          coverAmount: amt(10000000),
          annualPremium: amt(14500),
          currency: cur,
          insuredMemberId: ownerMemberId,
          nomineeName: 'Family Nominee',
          renewalDate: `${shiftMonth(month, 6)}-15`,
        },
      ],
    };
  }

  if (templateId === 'couple') {
    const hasPartner = current.members.some((m) => m.role === 'partner');
    const members = hasPartner
      ? current.members
      : [
          ...current.members,
          {
            id: partnerId,
            name: 'Partner',
            role: 'partner' as const,
            avatar: '👩🏽‍🎨',
            color: '#0d9488',
            monthlyAllowance: amt(40000),
          },
        ];
    const pId = current.members.find((m) => m.role === 'partner')?.id ?? partnerId;
    return {
      ...current,
      settings: baseSettings,
      members,
      accounts: [updatedPrimary],
      transactions: [
        {
          id: `tx-tpl-c1-${Date.now()}`,
          type: 'income',
          amount: amt(125000),
          currency: cur,
          baseAmount: amt(125000),
          date: `${month}-01`,
          merchant: 'Combined Monthly Income',
          categoryId: 'cat-salary',
          accountId: updatedPrimary.id,
          memberId: ownerMemberId,
          tags: ['income'],
          note: 'Starter household income',
          status: 'cleared',
          createdAt: nowIso,
        },
        {
          id: `tx-tpl-c2-${Date.now()}`,
          type: 'expense',
          amount: amt(16000),
          currency: cur,
          baseAmount: amt(16000),
          date: today,
          merchant: 'Shared Household & Utilities',
          categoryId: 'cat-utilities',
          accountId: updatedPrimary.id,
          memberId: ownerMemberId,
          memberSplits: [
            { memberId: ownerMemberId, amount: amt(8000), settled: true },
            { memberId: pId, amount: amt(8000), settled: false },
          ],
          tags: ['shared'],
          note: '50/50 couple split example',
          status: 'cleared',
          createdAt: nowIso,
        },
      ],
      goals: [
        {
          id: `goal-tpl-c1-${Date.now()}`,
          name: 'Annual Travel & Wealth Fund',
          targetAmount: amt(250000),
          currentAmount: amt(75000),
          targetDate: `${shiftMonth(month, 10)}-01`,
          category: 'travel',
          linkedAccountId: updatedPrimary.id,
          ownerId: 'm-shared',
          priority: 'medium',
          color: '#0ea5e9',
          icon: '✈️',
        },
      ],
    };
  }

  // student / freelancer
  return {
    ...current,
    settings: baseSettings,
    accounts: [updatedPrimary],
    transactions: [
      {
        id: `tx-tpl-s1-${Date.now()}`,
        type: 'income',
        amount: amt(32000),
        currency: cur,
        baseAmount: amt(32000),
        date: `${month}-02`,
        merchant: 'Freelance / Monthly Allowance',
        categoryId: 'cat-freelance',
        accountId: updatedPrimary.id,
        memberId: ownerMemberId,
        tags: ['freelance'],
        note: 'Starter inflow',
        status: 'cleared',
        createdAt: nowIso,
      },
      {
        id: `tx-tpl-s2-${Date.now()}`,
        type: 'expense',
        amount: amt(9500),
        currency: cur,
        baseAmount: amt(9500),
        date: today,
        merchant: 'Hostel, Meals & Wi-Fi',
        categoryId: 'cat-dining',
        accountId: updatedPrimary.id,
        memberId: ownerMemberId,
        tags: ['living'],
        note: 'Starter living expense',
        status: 'cleared',
        createdAt: nowIso,
      },
    ],
    goals: [
      {
        id: `goal-tpl-s1-${Date.now()}`,
        name: 'Emergency & Upskilling Cushion',
        targetAmount: amt(60000),
        currentAmount: amt(18000),
        targetDate: `${shiftMonth(month, 8)}-01`,
        category: 'emergency',
        linkedAccountId: updatedPrimary.id,
        ownerId: ownerMemberId,
        priority: 'high',
        color: '#8b5cf6',
        icon: '🎓',
      },
    ],
  };
}
