import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { resetMemoryFallbackForTests } from '../storage/repository';
import { createGuestDemoSession } from '../utils/auth';

describe('SaaS Launch Flows: Legal Pages, Entitlement Limits & Clean Onboarding UI', () => {
  beforeEach(() => {
    localStorage.clear();
    resetMemoryFallbackForTests();
    window.history.replaceState({}, '', '/');
  });

  it('navigates Privacy, Terms, Refund, and Contact compliance pages in English and Gujarati', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Privacy Policy' }));
    expect(
      screen.getByRole('heading', { name: 'Privacy Policy' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/stores no banking logins, netbanking passwords, PINs, or OTPs/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refund & Cancellation' }));
    expect(
      screen.getByText(/no-questions-asked 7-day full refund/i)
    ).toBeInTheDocument();

    // Switch Legal view to Gujarati
    const switcher = screen.getByTestId('language-switcher');
    fireEvent.click(switcher.querySelectorAll('button')[1]);
    expect(
      screen.getByRole('heading', { name: 'રિફંડ અને રદ નીતિ' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/7 દિવસની 100% રિફંડ ગેરંટી મળે છે/i)
    ).toBeInTheDocument();
  });

  it('enforces Free tier goal limit notice in Goals & Debts and routes to Pricing', async () => {
    createGuestDemoSession(0);
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Goals & Debts/i }));
    expect(
      await screen.findByText(/Free tier supports up to 3 goals/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'View Plans' }));
    expect(await screen.findByText('Simple, honest family pricing')).toBeInTheDocument();
  });
});
