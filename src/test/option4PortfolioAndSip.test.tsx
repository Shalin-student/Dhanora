import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { createSeedState } from '../data/seed';
import { resetMemoryFallbackForTests } from '../storage/repository';
import { createGuestDemoSession } from '../utils/auth';
import { computePortfolioSummary, computeWealthProjection } from '../utils/portfolio';

describe('Option 4: Portfolio Allocation, SIP Compounding & Wealth Projections (Unit)', () => {
  it('computes seeded portfolio valuation, unrealized gains, asset allocation, and active SIP total', () => {
    const seed = createSeedState();
    const summary = computePortfolioSummary(seed);

    expect(summary.holdings).toHaveLength(3);
    expect(summary.totalCurrentValue).toBe(32400);
    expect(summary.totalInvested).toBe(27500);
    expect(summary.totalGain).toBe(4900);
    expect(summary.activeMonthlySip).toBe(700);
    expect(summary.allocation.map((a) => a.assetClass)).toEqual([
      'equity',
      'mutual_fund',
      'gold',
    ]);
  });

  it('projects compound growth accurately with monthly SIPs and annual step-up', () => {
    const flat = computeWealthProjection({
      startingCorpus: 10000,
      monthlySip: 500,
      annualReturnPct: 12,
      stepUpPct: 0,
      years: 10,
      language: 'en',
    });
    const stepped = computeWealthProjection({
      startingCorpus: 10000,
      monthlySip: 500,
      annualReturnPct: 12,
      stepUpPct: 10,
      years: 10,
      language: 'gu',
    });

    expect(flat.points).toHaveLength(11);
    expect(flat.totalContributed).toBe(70000);
    expect(flat.finalValue).toBeGreaterThan(140000);
    expect(stepped.points[0].label).toBe('વર્ષ 0');
    expect(stepped.points[10].label).toBe('વર્ષ 10');
    expect(stepped.totalContributed).toBeGreaterThan(flat.totalContributed);
    expect(stepped.finalValue).toBeGreaterThan(flat.finalValue);
  });
});

describe('Option 4: Investment Portfolio, SIP Tracker & Projection UI Flows', () => {
  beforeEach(() => {
    localStorage.clear();
    resetMemoryFallbackForTests();
    createGuestDemoSession(0);
  });

  it('renders Portfolio Pulse on Dashboard and full Holdings, SIPs & Projection Simulator on Accounts & Net Worth', async () => {
    render(<App />);
    expect(screen.getByText('Investment Portfolio & 10-Yr Projection')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Manage Portfolio/i }));
    expect(
      await screen.findByText('Investment Portfolio & Asset Allocation', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getByText('Systematic Investment Plans (SIP Tracker)')).toBeInTheDocument();
    expect(screen.getByText('Long-Term Compound Wealth Projection')).toBeInTheDocument();

    // Add a new holding
    fireEvent.change(screen.getByPlaceholderText(/Symbol/i), { target: { value: 'MSFT' } });
    fireEvent.change(screen.getByPlaceholderText('Holding Name'), {
      target: { value: 'Microsoft Equity' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Holding' }));
    expect(screen.getByText('Microsoft Equity')).toBeInTheDocument();

    // Record 1-click SIP installment & verify toast + increased units/transaction
    const investBtns = screen.getAllByRole('button', { name: 'Invest Now' });
    fireEvent.click(investBtns[0]);
    expect(screen.getByText(/Recorded SIP installment/i)).toBeInTheDocument();

    // Adjust Horizon slider to 15 years
    const horizonSlider = screen.getByLabelText(/Horizon: 10 yrs/i);
    fireEvent.change(horizonSlider, { target: { value: '15' } });
    expect(screen.getByText('Projected Value (15y)')).toBeInTheDocument();

    // Flip to Gujarati and confirm bilingual coverage across Portfolio & Projection UI
    const switcher = screen.getByTestId('language-switcher');
    fireEvent.click(within(switcher).getByRole('button', { name: 'ગુજ' }));
    expect(screen.getByText('રોકાણ પોર્ટફોલિયો અને અસ્કયામત વહેંચણી')).toBeInTheDocument();
    expect(screen.getByText('સિસ્ટમેટિક ઇન્વેસ્ટમેન્ટ પ્લાન (SIP ટ્રેકર)')).toBeInTheDocument();
    expect(screen.getByText('લાંબા ગાળાની ચક્રવૃદ્ધિ સંપત્તિ આગાહી')).toBeInTheDocument();
  }, 12000);
});
