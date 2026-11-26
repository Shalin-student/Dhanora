import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { createSeedState } from '../data/seed';
import { resetMemoryFallbackForTests } from '../storage/repository';
import { createGuestDemoSession } from '../utils/auth';
import {
  filterAccountsForActor,
  filterGoalsForActor,
  getRoleCapabilities,
  isViewAllowedForRole,
} from '../utils/permissions';

describe('Role Capabilities & Scoping Utilities (Unit)', () => {
  it('enforces distinct capabilities for admin, partner, dependent, and advisor roles', () => {
    const admin = getRoleCapabilities('admin');
    expect(admin.isDependent).toBe(false);
    expect(admin.canDeleteHouseholdData).toBe(true);
    expect(admin.canManageSettings).toBe(true);

    const partner = getRoleCapabilities('partner');
    expect(partner.isDependent).toBe(false);
    expect(partner.canManageSettings).toBe(true);
    expect(partner.canDeleteHouseholdData).toBe(false);

    const dependent = getRoleCapabilities('dependent');
    expect(dependent.isDependent).toBe(true);
    expect(dependent.canViewAllMembers).toBe(false);
    expect(dependent.canManageBudgetsAndBills).toBe(false);
    expect(dependent.canManageSettings).toBe(false);
    expect(dependent.canDeleteHouseholdData).toBe(false);
    expect(dependent.allowedViews).toEqual(['dashboard', 'transactions', 'receipts', 'goals']);

    const advisor = getRoleCapabilities('advisor');
    expect(advisor.isDependent).toBe(false);
    expect(advisor.allowedViews).toContain('calculators');
    expect(advisor.allowedViews).toContain('pricing');
    expect(advisor.allowedViews).not.toContain('safety'); // private family emergency pack hidden
  });

  it('filters allowed views, accounts, and goals cleanly for dependent profile', () => {
    const seed = createSeedState();
    const leo = seed.members.find((m) => m.id === 'm-leo');
    const alex = seed.members.find((m) => m.id === 'm-alex');

    expect(isViewAllowedForRole('dashboard', 'dependent')).toBe(true);
    expect(isViewAllowedForRole('goals', 'dependent')).toBe(true);
    expect(isViewAllowedForRole('budgets', 'dependent')).toBe(false);
    expect(isViewAllowedForRole('settings', 'dependent')).toBe(false);
    expect(isViewAllowedForRole('family', 'dependent')).toBe(false);

    const leoAccounts = filterAccountsForActor(seed.accounts, leo);
    expect(leoAccounts.map((a) => a.id)).toEqual(['acc-cash']);
    expect(filterAccountsForActor(seed.accounts, alex)).toHaveLength(seed.accounts.length);

    const leoGoals = filterGoalsForActor(seed.goals, leo);
    expect(leoGoals.map((g) => g.id)).toEqual(['goal-3']);
    expect(filterGoalsForActor(seed.goals, alex)).toHaveLength(seed.goals.length);
  });
});

describe('Auth-Detected Roles (No In-App Switcher) & Audit Feed UI', () => {
  beforeEach(() => {
    localStorage.clear();
    resetMemoryFallbackForTests();
    window.history.replaceState({}, '', '/');
  });

  it('removes manual Acting As role switcher from sidebar and detects Dependent role strictly via Sign In', async () => {
    render(<App />);

    // Open Sign In from Landing Page and click Leo (Dependent) account
    fireEvent.click(screen.getAllByRole('button', { name: 'Sign in' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /leo@carter\.family/i }));

    expect(await screen.findByText(/Leo.*Allowance & Goals/i)).toBeInTheDocument();
    expect(screen.getByText(/Personal Allowance View \(Dependent Scope\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/Acting As/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Active family profile')).not.toBeInTheDocument();

    // Restricted sidebar routes hidden in dependent role
    expect(screen.queryByRole('button', { name: /Budgets/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Settings/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Insurance & Safety/i })).not.toBeInTheDocument();

    // Goals view hides debt simulator
    fireEvent.click(screen.getByRole('button', { name: /Goals & Debts/i }));
    expect(await screen.findByText('Leo College 529 Milestone')).toBeInTheDocument();
    expect(screen.queryByText(/Debt Payoff/i)).not.toBeInTheDocument();

    // Quick Entry as Leo restricts accounts
    fireEvent.click(screen.getByRole('button', { name: /Add Transaction/i }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText(/Sapphire Rewards Card/i)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/Family Cash Wallet/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));

    // Sign out -> Sign in with Demo Advisor detects Advisor role (calculators allowed, emergency safety hidden)
    fireEvent.click(screen.getByRole('button', { name: /Sign out/i }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Sign in' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /meera@advisor\.in/i }));
    expect(await screen.findByText('Household Financial Pulse')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Calculators & FIRE/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Insurance & Safety/i })).not.toBeInTheDocument();
  });

  it('records household activity into Family & Splits audit feed', async () => {
    createGuestDemoSession(0);
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Add Transaction/i }));
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '42.00' } });
    fireEvent.change(screen.getByPlaceholderText(/Trader Joe/i), {
      target: { value: 'Audited Bookstore' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Transaction' }));

    fireEvent.click(screen.getByRole('button', { name: /Family & Splits/i }));
    expect(await screen.findByText('Household Activity Audit Feed')).toBeInTheDocument();
    expect(
      screen.getByText(/Added expense "Audited Bookstore" \(42 USD\)/i)
    ).toBeInTheDocument();
  });
});
