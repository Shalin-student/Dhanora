import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { createSeedState } from '../data/seed';
import { resetMemoryFallbackForTests } from '../storage/repository';
import {
  compareIndianTaxRegimes,
  comparePrepayVsInvest,
  compareRentVsBuy,
  containsSensitiveCredentialHint,
  parseAmountShorthand,
  simulateFirePlan,
} from '../utils/planners';

describe('SampattiPlanner Reference Math: Tax, FIRE, Rent/Buy, Prepay & Shorthand (Unit)', () => {
  it('parses Indian Lakh/Crore shorthand strings accurately', () => {
    expect(parseAmountShorthand('25L')).toBe(2500000);
    expect(parseAmountShorthand('1.5Cr')).toBe(15000000);
    expect(parseAmountShorthand('50k')).toBe(50000);
    expect(parseAmountShorthand('₹2,74,667')).toBe(274667);
  });

  it('computes FY 2026-27 Old vs New Tax Regime accurately incl. Sec 87A 12L rebate', () => {
    // At ₹12.75L salaried, ₹75k std ded -> ₹12L taxable -> New Regime 0 tax!
    const lowSalaried = compareIndianTaxRegimes({
      annualGrossIncome: 1275000,
      deduction80C: 0,
      deduction80D: 0,
      hraExemption: 0,
      homeLoanInterest24B: 0,
      nps80CCD1B: 0,
    });
    expect(lowSalaried.newRegimeTaxableIncome).toBe(1200000);
    expect(lowSalaried.newRegimeTax).toBe(0);

    // At ₹20L with heavy 80C + HRA + 24(b) + 80D + NPS, compare regimes cleanly
    const heavyDed = compareIndianTaxRegimes({
      annualGrossIncome: 2000000,
      deduction80C: 150000,
      deduction80D: 50000,
      hraExemption: 360000,
      homeLoanInterest24B: 200000,
      nps80CCD1B: 50000,
    });
    expect(heavyDed.oldRegimeTax).toBeGreaterThan(0);
    expect(heavyDed.newRegimeTax).toBeGreaterThan(0);
  });

  it('runs FIRE simulation, Rent vs Buy, Prepay vs Invest, and Emergency password guard', () => {
    const fire = simulateFirePlan({
      currentAge: 32,
      retireAge: 52,
      lifeExpectancy: 90,
      currentCorpus: 3000000,
      monthlyInvestment: 80000,
      monthlyRetirementExpenseToday: 60000,
      inflationPct: 6,
      preRetireReturnPct: 12,
      postRetireReturnPct: 8,
      postRetireTaxPct: 10,
    });
    expect(fire.corpusAtRetirement).toBeGreaterThan(fire.requiredFireCorpus);
    expect(fire.isViableToLifeExpectancy).toBe(true);

    const rentBuy = compareRentVsBuy({
      homePrice: 9000000,
      downPaymentPct: 20,
      loanRatePct: 8.5,
      loanYears: 20,
      monthlyRent: 32000,
      rentGrowthPct: 6,
      homeAppreciationPct: 7,
      investmentReturnPct: 11,
      horizonYears: 12,
    });
    expect(rentBuy.monthlyEmi).toBeGreaterThan(50000);
    expect(['buy', 'rent']).toContain(rentBuy.winner);

    const prepay = comparePrepayVsInvest({
      outstandingLoan: 3000000,
      loanAprPct: 8.5,
      remainingMonths: 180,
      extraMonthlySurplus: 15000,
      expectedInvestReturnPct: 12,
      investTaxDragPct: 12.5,
    });
    expect(prepay.monthsSaved).toBeGreaterThan(30);
    expect(prepay.recommended).toBe('invest');

    expect(containsSensitiveCredentialHint('ATM pin: 1234')).toBe(true);
    expect(containsSensitiveCredentialHint('Home Safe Shelf 2')).toBe(false);
    expect(createSeedState().policies).toHaveLength(2);
  });
});

describe('Commercial SaaS Landing, Pricing, Role Sign-Up/Sign-In, Calculators & Safety Pack UI', () => {
  beforeEach(() => {
    localStorage.clear();
    resetMemoryFallbackForTests();
  });

  it('renders Public SaaS Landing, toggles INR/USD Pricing, registers new Partner via Sign Up, signs out & signs back in with role preserved', async () => {
    render(<App />);

    // Landing Hero & FAQ
    expect(screen.getByText('Family finances, sorted in minutes.')).toBeInTheDocument();
    expect(screen.getByText('Everything in one calm family plan')).toBeInTheDocument();

    // Embedded Pricing switches currency INR <-> USD
    expect(screen.getByText('₹1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    expect(screen.getByText('$15')).toBeInTheDocument();

    // Open Sign Up, expand optional Role & Invite drawer, select Partner role -> role automatically detected inside app!
    fireEvent.click(screen.getByRole('button', { name: 'Create free account' }));
    fireEvent.change(screen.getByLabelText('Your Name'), { target: { value: 'Neha Shah' } });
    fireEvent.click(
      screen.getByRole('button', { name: /Joining with an Invite Code or as Partner/i })
    );
    fireEvent.change(screen.getByLabelText('Account Role'), { target: { value: 'partner' } });
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'neha@shah.family' },
    });
    fireEvent.change(screen.getByLabelText('Password / Passphrase'), {
      target: { value: 'shah-family-pass-12' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account & Enter Plan' }));

    expect(await screen.findByText('Household Financial Pulse')).toBeInTheDocument();
    expect(screen.getAllByText('Neha Shah').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('partner').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Acting As/i)).not.toBeInTheDocument();

    // Sign out -> Sign in with real credentials -> detects Partner role again
    fireEvent.click(screen.getByRole('button', { name: /Sign out/i }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Sign in' })[0]);
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'neha@shah.family' },
    });
    fireEvent.change(screen.getByLabelText('Password / Passphrase'), {
      target: { value: 'shah-family-pass-12' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In to Workspace' }));
    expect((await screen.findAllByText('Neha Shah')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('partner').length).toBeGreaterThanOrEqual(1);

    // Open Pricing & Plan inside app & activate Plus trial
    fireEvent.click(screen.getByRole('button', { name: /Pricing & Plan/i }));
    expect(await screen.findByText('Simple, honest family pricing')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Activate 30-Day Free Plus Trial' }));
    expect(screen.getByText('PLUS Plan')).toBeInTheDocument();

    // Open Calculators & FIRE
    fireEvent.click(screen.getByRole('button', { name: /Calculators & FIRE/i }));
    expect(
      await screen.findByText('Calculators, Tax Regime & FIRE Planner')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Old vs New Tax/i }));
    expect(screen.getByText('New Tax Regime Total Tax')).toBeInTheDocument();

    // Open Insurance & Safety -> Nominee Audit verifies clean isolated Primary Bank Account
    fireEvent.click(screen.getByRole('button', { name: /Insurance & Safety/i }));
    expect(
      await screen.findByText('Insurance Adequacy, Nominee Audit & Emergency Pack')
    ).toBeInTheDocument();
    expect(screen.queryByText(/The Carter Family/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Primary Bank Account — Missing Nominee/i)).toBeInTheDocument();

    // Assign nominee on missing brokerage account -> audit passes!
    const nomineeAudit = screen.getByTestId('nominee-audit-section');
    fireEvent.change(within(nomineeAudit).getByPlaceholderText('Nominee full name'), {
      target: { value: 'Maya' },
    });
    fireEvent.click(within(nomineeAudit).getByRole('button', { name: 'Assign Nominee' }));
    expect(
      screen.getByText('All eligible accounts & policies have assigned nominees.')
    ).toBeInTheDocument();

    // Switch entire SaaS site to Gujarati cleanly
    const switcher = screen.getByTestId('language-switcher');
    fireEvent.click(within(switcher).getByRole('button', { name: 'ગુજ' }));
    expect(
      screen.getByText('વીમા કવચ તપાસ, નોમિની ઓડિટ અને કટોકટી માર્ગદર્શિકા')
    ).toBeInTheDocument();
  }, 15000);
});
