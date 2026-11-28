import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { BrandLogoButton, BrandMark } from '../components/BrandMark';
import { translate, TRANSLATIONS } from '../i18n';
import { resetMemoryFallbackForTests } from '../storage/repository';
import { createGuestDemoSession } from '../utils/auth';

describe('M2 Global Rebrand, BrandWordmark & Logo Routing', () => {
  beforeEach(() => {
    localStorage.clear();
    resetMemoryFallbackForTests();
    window.history.replaceState({}, '', '/');
    document.documentElement.lang = 'en';
  });

  it('displays literal Dhanora (ધનોરા) in en & gu dictionaries with zero user-facing HearthLedger leaks', () => {
    expect(translate('en', 'brand.name')).toBe('Dhanora (ધનોરા)');
    expect(translate('gu', 'brand.name')).toBe('Dhanora (ધનોરા)');
    expect(translate('en', 'meta.docTitle').startsWith('Dhanora (ધનોરા)')).toBe(true);
    expect(translate('gu', 'meta.docTitle').startsWith('Dhanora (ધનોરા)')).toBe(true);
    expect(translate('en', 'rcpt.engineIdb')).toBe('IndexedDB (hearthledger_db)');

    for (const [key, entry] of Object.entries(TRANSLATIONS)) {
      if (key === 'rcpt.engineIdb') continue;
      expect(entry.en, `Legacy brand leaked in ${key}.en`).not.toMatch(/HearthLedger/i);
      expect(entry.gu, `Legacy brand leaked in ${key}.gu`).not.toMatch(/HearthLedger|હાર્થલેજર/i);
    }
  });

  it('updates document.title with Dhanora (ધનોરા) when toggling EN <-> ગુજ', async () => {
    render(<App />);
    expect(document.title).toContain('Dhanora (ધનોરા)');

    const switcher = screen.getByTestId('language-switcher');
    fireEvent.click(within(switcher).getByRole('button', { name: 'ગુજ' }));
    expect(document.title).toContain('Dhanora (ધનોરા)');
    expect(document.documentElement.lang).toBe('gu');

    fireEvent.click(within(switcher).getByRole('button', { name: 'EN' }));
    expect(document.title).toContain('Dhanora (ધનોરા)');
    expect(document.documentElement.lang).toBe('en');
  });

  it('renders BrandMark with explicit zero-CLS SVG dimensions (<=250x100) and accessible BrandLogoButton', () => {
    const { container, rerender } = render(<BrandMark size="sm" />);
    const svgSm = container.querySelector('svg');
    expect(svgSm).not.toBeNull();
    expect(Number(svgSm?.getAttribute('width'))).toBe(16);
    expect(Number(svgSm?.getAttribute('height'))).toBe(16);

    rerender(<BrandMark size="md" />);
    const svgMd = container.querySelector('svg');
    expect(Number(svgMd?.getAttribute('width'))).toBe(20);
    expect(Number(svgMd?.getAttribute('height'))).toBe(20);

    rerender(<BrandMark size="lg" />);
    const svgLg = container.querySelector('svg');
    expect(Number(svgLg?.getAttribute('width'))).toBe(24);
    expect(Number(svgLg?.getAttribute('height'))).toBe(24);
    expect(Number(svgLg?.getAttribute('width'))).toBeLessThanOrEqual(250);
    expect(Number(svgLg?.getAttribute('height'))).toBeLessThanOrEqual(100);

    const onClick = vi.fn();
    render(
      <BrandLogoButton
        size="md"
        subtitle="Family Vault"
        subtitleClassName="hidden sm:block"
        onClick={onClick}
      />
    );
    const btn = screen.getByRole('button', { name: /Dhanora \(ધનોરા\)/i });
    expect(btn).toHaveAttribute('type', 'button');
    expect(btn.className).toContain('min-h-[44px]');
    expect(btn.className).toContain('min-w-[44px]');
    expect(btn.textContent).toContain('Dhanora (ધનોરા)');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('routes logo clicks to / from /signin, /signup, /privacy, and /pricing (closing demo drawer)', () => {
    // 1. /signin with Demo Role drawer expanded
    window.history.replaceState({}, '', '/signin');
    const { unmount } = render(<App />);
    expect(screen.getByText(/Sign in to your household/i)).toBeInTheDocument();

    const demoToggle = screen.getByRole('button', { name: /Explore Demo Roles/i });
    fireEvent.click(demoToggle);
    expect(demoToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('alex@carter.family')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Dhanora \(ધનોરા\)/i }));
    expect(window.location.pathname).toBe('/');
    expect(screen.getByText('Family finances, sorted in minutes.')).toBeInTheDocument();
    unmount();

    // 2. /signup
    window.history.replaceState({}, '', '/signup');
    const r2 = render(<App />);
    expect(screen.getByText(/Create your household account/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Dhanora \(ધનોરા\)/i }));
    expect(window.location.pathname).toBe('/');
    expect(screen.getByText('Family finances, sorted in minutes.')).toBeInTheDocument();
    r2.unmount();

    // 3. /privacy
    window.history.replaceState({}, '', '/privacy');
    const r3 = render(<App />);
    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByText(/Dhanora \(ધનોરા\) stores no banking logins/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Dhanora \(ધનોરા\)/i }));
    expect(window.location.pathname).toBe('/');
    expect(screen.getByText('Family finances, sorted in minutes.')).toBeInTheDocument();
    r3.unmount();

    // 4. /pricing
    window.history.replaceState({}, '', '/pricing');
    const r4 = render(<App />);
    const logoButtons = screen.getAllByRole('button', { name: /Dhanora \(ધનોરા\)/i });
    fireEvent.click(logoButtons[0]);
    expect(window.location.pathname).toBe('/');
    expect(screen.getByText('Family finances, sorted in minutes.')).toBeInTheDocument();
    r4.unmount();
  });

  it('routes logo clicks to Dashboard Overview inside signed-in Layout', async () => {
    createGuestDemoSession(0);
    render(<App />);
    expect(screen.getByText('Household Financial Pulse')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Transactions/i }));
    expect(await screen.findByText('Transactions Ledger')).toBeInTheDocument();

    const logoBtns = screen.getAllByRole('button', { name: /Dhanora \(ધનોરા\)/i });
    fireEvent.click(logoBtns[0]);
    expect(await screen.findByText('Household Financial Pulse')).toBeInTheDocument();
  });
});
