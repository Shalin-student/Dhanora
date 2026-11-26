import type { Account, ActiveView, FamilyMember, MemberRole, SavingsGoal } from '../types/finance';

export interface RoleCapabilities {
  role: MemberRole;
  isDependent: boolean;
  canViewAllMembers: boolean;
  canManageBudgetsAndBills: boolean;
  canManageSettings: boolean;
  canDeleteHouseholdData: boolean;
  allowedViews: ActiveView[];
}

const ALL_VIEWS: ActiveView[] = [
  'dashboard',
  'transactions',
  'receipts',
  'budgets',
  'bills',
  'automation',
  'goals',
  'accounts',
  'safety',
  'calculators',
  'family',
  'reports',
  'pricing',
  'settings',
];

const ADVISOR_VIEWS: ActiveView[] = [
  'dashboard',
  'transactions',
  'budgets',
  'bills',
  'goals',
  'accounts',
  'calculators',
  'family',
  'reports',
  'pricing',
];

const DEPENDENT_VIEWS: ActiveView[] = ['dashboard', 'transactions', 'receipts', 'goals'];

export function getRoleCapabilities(role: MemberRole = 'admin'): RoleCapabilities {
  if (role === 'dependent') {
    return {
      role,
      isDependent: true,
      canViewAllMembers: false,
      canManageBudgetsAndBills: false,
      canManageSettings: false,
      canDeleteHouseholdData: false,
      allowedViews: DEPENDENT_VIEWS,
    };
  }

  if (role === 'advisor') {
    return {
      role: 'advisor',
      isDependent: false,
      canViewAllMembers: true,
      canManageBudgetsAndBills: true,
      canManageSettings: false,
      canDeleteHouseholdData: false,
      allowedViews: ADVISOR_VIEWS,
    };
  }

  if (role === 'partner' || role === 'shared') {
    return {
      role,
      isDependent: false,
      canViewAllMembers: true,
      canManageBudgetsAndBills: true,
      canManageSettings: true,
      canDeleteHouseholdData: false,
      allowedViews: ALL_VIEWS,
    };
  }

  return {
    role: 'admin',
    isDependent: false,
    canViewAllMembers: true,
    canManageBudgetsAndBills: true,
    canManageSettings: true,
    canDeleteHouseholdData: true,
    allowedViews: ALL_VIEWS,
  };
}

export function isViewAllowedForRole(view: ActiveView, role: MemberRole = 'admin'): boolean {
  return getRoleCapabilities(role).allowedViews.includes(view);
}

export function filterAccountsForActor(
  accounts: Account[],
  actor: FamilyMember | undefined
): Account[] {
  if (!actor || actor.role !== 'dependent') return accounts;
  return accounts.filter((acc) => acc.ownerId === actor.id || acc.type === 'cash');
}

export function filterGoalsForActor(
  goals: SavingsGoal[],
  actor: FamilyMember | undefined
): SavingsGoal[] {
  if (!actor || actor.role !== 'dependent') return goals;
  return goals.filter((goal) => goal.ownerId === actor.id);
}
