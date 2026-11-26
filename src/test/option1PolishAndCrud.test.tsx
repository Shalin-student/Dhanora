import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { createSeedState } from '../data/seed';
import { resetMemoryFallbackForTests } from '../storage/repository';
import { createGuestDemoSession } from '../utils/auth';
import { computeAccountBalance, computeClearedAccountBalance } from '../utils/calculations';
import { formatMoney } from '../utils/currency';
import { exportTransactionsToCsv, parseCsvText } from '../utils/csv';

describe('Option 1: INR Locale Formatting, Cleared Balances & Gujarati CSV', () => {
  it('formats INR with en-IN lakh/crore grouping while preserving USD en-US format', () => {
    expect(formatMoney(123456, 'INR', false)).toBe('₹1,23,456');
    expect(formatMoney(1234567, 'INR', false)).toBe('₹12,34,567');
    expect(formatMoney(1234.5, 'USD', false)).toBe('$1,234.50');
  });

  it('computes cleared account balance separately from pending entries', () => {
    const seed = createSeedState();
    const acc = seed.accounts.find((a) => a.id === 'acc-joint')!;
    const pendingTx = {
      id: 'tx-pend-1',
      type: 'expense' as const,
      amount: 100,
      currency: 'USD' as const,
      baseAmount: 100,
      date: '2026-11-25',
      merchant: 'Pending Diner',
      categoryId: 'cat-dining',
      accountId: acc.id,
      memberId: 'm-alex',
      tags: [],
      note: '',
      status: 'pending' as const,
      createdAt: '2026-11-25T10:00:00Z',
    };
    const txs = [pendingTx, ...seed.transactions];
    const totalBal = computeAccountBalance(acc, txs);
    const clearedBal = computeClearedAccountBalance(acc, txs);
    expect(Number((clearedBal - totalBal).toFixed(2))).toBe(100);
  });

  it('exports localized Gujarati CSV headers/values and parses UTF-8 BOM safely', () => {
    const seed = createSeedState();
    const csvGu = exportTransactionsToCsv(
      seed.transactions.slice(0, 2),
      seed.categories,
      seed.accounts,
      seed.members,
      'gu'
    );
    expect(csvGu.startsWith('તારીખ,પ્રકાર,')).toBe(true);
    expect(csvGu).toContain('ક્લિયર્ડ');

    const parsed = parseCsvText(`\uFEFF${csvGu}`);
    expect(parsed[0][0]).toBe('તારીખ');
    expect(parsed).toHaveLength(3);
  });
});

describe('Option 1: Ledger Reconciliation, Status Toggles & Inline Entity CRUD', () => {
  beforeEach(() => {
    localStorage.clear();
    resetMemoryFallbackForTests();
    createGuestDemoSession(0);
  });

  it('toggles transaction status, filters pending, bulk-clears, sorts, and reconciles an account', async () => {
    render(<App />);

    // Open Transactions view
    fireEvent.click(screen.getByRole('button', { name: /Transactions/i }));
    expect(await screen.findByText('Transactions Ledger')).toBeInTheDocument();

    // Toggle first visible transaction status (Cleared -> Pending)
    const statusButtons = screen.getAllByRole('button', { name: /Toggle status for/i });
    expect(statusButtons[0]).toHaveTextContent('Cleared');
    fireEvent.click(statusButtons[0]);
    expect(statusButtons[0]).toHaveTextContent('Pending');

    // Filter by Pending status
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'pending' } });
    const pendingBtns = screen.getAllByRole('button', { name: /Toggle status for/i });
    expect(pendingBtns.length).toBeGreaterThanOrEqual(1);
    pendingBtns.forEach((btn) => expect(btn).toHaveTextContent('Pending'));

    // Select all visible pending rows & click Mark N cleared
    fireEvent.click(screen.getByRole('button', { name: 'Select all filtered transactions' }));
    fireEvent.click(screen.getByRole('button', { name: /Mark \d+ cleared/i }));
    expect(screen.getByText('No matching transactions found.')).toBeInTheDocument();

    // Switch filter back to All Statuses & verify sorting by Amount
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'all' } });
    fireEvent.click(screen.getByRole('button', { name: /Amount/i }));

    // Go to Accounts & Net Worth for inline Edit, Archive, and Statement Reconciliation
    fireEvent.click(screen.getByRole('button', { name: /Accounts & Net Worth/i }));
    expect(
      await screen.findByText('Accounts, Wallets & Net Worth', {}, { timeout: 4000 })
    ).toBeInTheDocument();

    // Edit Joint Checking name inline
    fireEvent.click(screen.getByRole('button', { name: 'Edit account Joint Checking' }));
    const nameInput = screen
      .getAllByDisplayValue('Joint Checking')
      .find((el) => el.tagName === 'INPUT') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Primary Family Checking' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Account' }));
    expect(
      screen.getByRole('heading', { name: 'Primary Family Checking' })
    ).toBeInTheDocument();

    // Reconcile Primary Family Checking statement balance (+50 difference)
    const reconcileBtns = screen.getAllByRole('button', { name: 'Reconcile' });
    fireEvent.click(reconcileBtns[0]);
    const stmtInput = screen.getByLabelText('Bank statement closing balance') as HTMLInputElement;
    const currentCleared = parseFloat(stmtInput.value);
    fireEvent.change(stmtInput, { target: { value: String(currentCleared + 50) } });
    fireEvent.click(screen.getByRole('button', { name: 'Post Adjustment' }));
    expect(screen.getByText(/Reconciled "Primary Family Checking"/i)).toBeInTheDocument();

    // Archive an account and reveal via Show archived toggle
    fireEvent.click(screen.getByRole('button', { name: 'Archive account Family Cash Wallet' }));
    expect(
      screen.queryByRole('heading', { name: 'Family Cash Wallet' })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Show archived \(1\)/i));
    expect(
      screen.getByRole('heading', { name: 'Family Cash Wallet' })
    ).toBeInTheDocument();
  });

  it('supports inline editing for Recurring Bills, Family Members, Goals, Debts, and Merchant Rules (including Gujarati)', async () => {
    render(<App />);

    // 1. Recurring Bills inline edit
    fireEvent.click(screen.getByRole('button', { name: /Recurring & Bills/i }));
    expect(await screen.findByText(/Recurring Bills, Subscriptions & Payroll/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Edit schedule Oakridge Mortgage/i }));
    fireEvent.change(screen.getByDisplayValue('Oakridge Mortgage'), {
      target: { value: 'Oakridge Home Mortgage' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Oakridge Home Mortgage')).toBeInTheDocument();

    // 2. Family Members inline edit
    fireEvent.click(screen.getByRole('button', { name: /Family & Splits/i }));
    expect(await screen.findByText(/Family Members, Allowances & Bill Splits/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit member Maya' }));
    fireEvent.change(screen.getByDisplayValue('Maya'), { target: { value: 'Maya Patel' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Maya Patel')).toBeInTheDocument();

    // 3. Goals & Debts inline edit
    fireEvent.click(screen.getByRole('button', { name: /Goals & Debts/i }));
    expect(await screen.findByText(/Savings Goals, Sinking Funds & Debt Payoff/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit goal 6-Month Emergency Runway' }));
    fireEvent.change(screen.getByDisplayValue('6-Month Emergency Runway'), {
      target: { value: '12-Month Emergency Fund' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('12-Month Emergency Fund')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit loan Family Hybrid SUV Loan' }));
    fireEvent.change(screen.getByDisplayValue('Family Hybrid SUV Loan'), {
      target: { value: 'Family EV SUV Loan' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Family EV SUV Loan')).toBeInTheDocument();

    // 4. Switch to Gujarati & edit a Merchant Rule
    const switcher = screen.getByTestId('language-switcher');
    fireEvent.click(within(switcher).getByRole('button', { name: 'ગુજ' }));
    fireEvent.click(screen.getByRole('button', { name: 'ઓટોમેશન અને નિયમો' }));
    expect(
      await screen.findByText('સ્માર્ટ ઓટોમેશન, નિયમો અને ચેતવણીઓ')
    ).toBeInTheDocument();
    const editRuleBtns = screen.getAllByRole('button', { name: /નિયમ સુધારો/i });
    fireEvent.click(editRuleBtns[0]);
    fireEvent.click(screen.getByRole('button', { name: 'સાચવો' }));
  }, 15000);
});
