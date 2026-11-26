import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { resetMemoryFallbackForTests } from '../storage/repository';
import { createGuestDemoSession } from '../utils/auth';

describe('HearthLedger App UI', () => {
  beforeEach(() => {
    localStorage.clear();
    resetMemoryFallbackForTests();
    createGuestDemoSession(0);
  });

  it('renders household dashboard and navigates across lazy-loaded core tabs', async () => {
    render(<App />);
    expect(screen.getByText('Household Financial Pulse')).toBeInTheDocument();
    expect(screen.getByText('6-Month Cashflow Trend')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Transactions/i }));
    expect(await screen.findByText('Transactions Ledger')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Budgets/i }));
    expect(await screen.findByText(/Monthly Budgets & 50\/30\/20 Planner/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Recurring & Bills/i }));
    expect(await screen.findByText(/Recurring Bills, Subscriptions & Payroll/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Goals & Debts/i }));
    expect(await screen.findByText(/Savings Goals, Sinking Funds & Debt Payoff/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Family & Splits/i }));
    expect(await screen.findByText(/Shared Bill Splits & Settlements/i)).toBeInTheDocument();
  });

  it('allows adding a new transaction via Quick Entry modal and persists it', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Add Transaction/i }));
    expect(screen.getByText('Record Family Transaction')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '75.50' } });
    fireEvent.change(screen.getByPlaceholderText(/Trader Joe/i), {
      target: { value: 'Neighborhood Pharmacy' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Transaction' }));

    fireEvent.click(screen.getByRole('button', { name: /Transactions/i }));
    expect(await screen.findByText('Neighborhood Pharmacy')).toBeInTheDocument();
  });

  it('toggles privacy mode to mask monetary amounts', () => {
    render(<App />);
    const privacyBtn = screen.getByRole('button', { name: /Toggle privacy mode/i });
    fireEvent.click(privacyBtn);
    expect(screen.getAllByText('$••••').length).toBeGreaterThan(0);
  });
});
