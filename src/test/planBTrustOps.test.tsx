import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { resetMemoryFallbackForTests } from '../storage/repository';
import { createGuestDemoSession } from '../utils/auth';

describe('Plan B Trust & Operations UI: Forgot Password, Promo Codes & Feedback Box', () => {
  beforeEach(() => {
    localStorage.clear();
    resetMemoryFallbackForTests();
    window.history.replaceState({}, '', '/');
  });

  it('navigates Forgot Password and Token Reset screens cleanly from Sign In', () => {
    render(<App />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Sign in' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));

    expect(screen.getByText('Reset your household password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send Reset Link' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Already have a reset token?' }));
    expect(screen.getByLabelText('Reset Token')).toBeInTheDocument();
    expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save New Password' })).toBeInTheDocument();
  });

  it('applies STUDENT50 promo discount inside PricingView and submits in-app Feedback modal', async () => {
    createGuestDemoSession(0);
    render(<App />);

    // Apply promo code in PricingView (switch from USD demo default to INR first)
    fireEvent.click(screen.getByRole('button', { name: /Pricing & Plan/i }));
    expect(await screen.findByText('Simple, honest family pricing')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'INR' }));
    expect(screen.getByText('₹2')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Promo / Coupon Code'), {
      target: { value: 'student50' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.getByText(/STUDENT50 applied \(50% off\)/i)).toBeInTheDocument();
    expect(screen.queryByText('₹2')).not.toBeInTheDocument();
    expect(screen.getAllByText('₹1').length).toBeGreaterThanOrEqual(2);

    // Open Feedback modal from sidebar and submit feedback
    fireEvent.click(screen.getByRole('button', { name: 'Feedback & Support' }));
    expect(screen.getByText('Send Feedback or Report Issue')).toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText(/Describe what worked well, any bug you saw/i),
      { target: { value: 'Love the new Canva-style starter templates!' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send Feedback' }));

    expect(await screen.findByText(/Thanks! Your feedback has been saved\./i)).toBeInTheDocument();
  });
});
