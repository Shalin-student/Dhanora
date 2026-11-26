import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { resetMemoryFallbackForTests } from '../storage/repository';

describe('Option 1 + Option 2 Redesign: Hero Preview, Clean Auth Redirect, Grouped Nav & Templates', () => {
  beforeEach(() => {
    localStorage.clear();
    resetMemoryFallbackForTests();
    window.history.replaceState({}, '', '/');
  });

  it('switches Hero 3-Tab Live App Preview and renders Personas & Feature Comparison Matrix', () => {
    render(<App />);

    // Default Pulse tab visible
    expect(screen.getByText('₹42.84L')).toBeInTheDocument();
    expect(
      screen.getByText('Designed for how modern Indian families actually manage money')
    ).toBeInTheDocument();

    // Switch Hero interactive tabs
    fireEvent.click(screen.getByRole('button', { name: 'SIP & FIRE' }));
    expect(screen.getByText('₹2.48 Cr')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Nominee Shield' }));
    expect(screen.getByText('₹1.50 Cr Term + ₹15L Health')).toBeInTheDocument();

    // Comparison Matrix present in Pricing
    expect(screen.getByText('Compare plans side by side')).toBeInTheDocument();
    expect(screen.getByText('Advisor Privacy Guard ✓')).toBeInTheDocument();
  });

  it('removes Plan dropdown from Sign Up, starts account on Free, and redirects paid CTA intent to Pricing', async () => {
    render(<App />);

    // Click Advisor tier CTA from Landing Pricing
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Advisor Pro' }));

    // Sign Up has NO Selected Plan dropdown, shows pending upgrade banner
    expect(screen.queryByLabelText('Selected Plan')).not.toBeInTheDocument();
    expect(
      screen.getByText(/Creating your free account first — next stop: Advisor Practice/i)
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Your Name'), { target: { value: 'Aarav Patel' } });
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'aarav@patel.in' },
    });
    fireEvent.change(screen.getByLabelText('Password / Passphrase'), {
      target: { value: 'aarav-pass-1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account & Enter Plan' }));

    // Automatically enters Pricing & shows FREE Plan (never free Advisor!) with Pay CTA
    expect(await screen.findByText('Simple, honest family pricing')).toBeInTheDocument();
    expect(screen.getByText('FREE Plan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pay & Activate Plan \(₹2\)/i })).toBeInTheDocument();

    // Grouped sidebar sections visible
    expect(screen.getByText('Money & Cashflow')).toBeInTheDocument();
    expect(screen.getByText('Wealth & Shield')).toBeInTheDocument();
    expect(screen.getByText('Planning Tools')).toBeInTheDocument();
    expect(screen.getByText('Household & Plan')).toBeInTheDocument();
  });

  it('applies Canva-style Starter Template and updates 4-Step Family Financial Shield Checklist', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Create free account' }));
    fireEvent.change(screen.getByLabelText('Your Name'), { target: { value: 'Kiran Desai' } });
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'kiran@desai.in' },
    });
    fireEvent.change(screen.getByLabelText('Password / Passphrase'), {
      target: { value: 'kiran-pass-1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account & Enter Plan' }));

    // Lands on Dashboard with 0 of 4 shield checklist & Browse Starter Templates button
    expect(await screen.findByText('4-Step Family Financial Shield')).toBeInTheDocument();
    expect(screen.getByText('0 of 4 complete')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Browse Starter Templates' }));
    expect(screen.getByText('Pick a starter setup (30 seconds)')).toBeInTheDocument();

    // Apply Indian Salaried Family template (populates account balance, tx, goal, policy -> 4/4!)
    const useTemplateBtns = screen.getAllByRole('button', { name: 'Use Template' });
    fireEvent.click(useTemplateBtns[0]);

    expect(await screen.findByText('Monthly Salary Credit')).toBeInTheDocument();
    expect(screen.queryByText('4-Step Family Financial Shield')).not.toBeInTheDocument();
  });
});
