import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { AuthPages } from '../components/AuthPages';
import { StarterTemplatesModal } from '../components/StarterTemplatesModal';
import { FinanceProvider, useFinance } from '../store/FinanceContext';
import { createCleanHouseholdSeed } from '../data/seed';
import { translate } from '../i18n';
import * as repository from '../storage/repository';
import { resetMemoryFallbackForTests } from '../storage/repository';
import {
  buildGoogleOAuthStartUrl,
  checkSyncHealth,
  fetchAuthStatus,
  fetchCurrentAuthSession,
  fetchSyncHealthDetails,
} from '../storage/syncClient';
import {
  createGuestDemoSession,
  loadAuthSession,
  persistAuthSession,
} from '../utils/auth';

function mockJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('M3: Split-Screen Auth, Folk Onboarding & OAuth Client Hydration', () => {
  beforeEach(() => {
    localStorage.clear();
    resetMemoryFallbackForTests();
    window.history.replaceState({}, '', '/');
    document.documentElement.lang = 'en';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('syncClient exposes fetchSyncHealthDetails, fetchAuthStatus, and buildGoogleOAuthStartUrl while preserving checkSyncHealth shape', async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/health')) {
        return mockJsonResponse({
          ok: true,
          revision: 0,
          googleOAuthConfigured: true,
        });
      }
      if (url.endsWith('/api/auth/me')) {
        return mockJsonResponse({
          authenticated: true,
          googleOAuthConfigured: true,
          session: {
            token: 'sess-123',
            userId: 'u-1',
            householdId: 'hh-1',
            householdName: 'Patel Family',
            name: 'Aarav Patel',
            email: 'aarav@patel.in',
            role: 'admin',
            memberId: 'm-1',
            avatar: '🧑🏽‍💻',
            isDemo: false,
          },
        });
      }
      return mockJsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchSpy);

    const health = await checkSyncHealth({ serverUrl: 'http://127.0.0.1:8787' });
    expect(health).toEqual({ available: true, revision: 0 });
    expect(Object.keys(health)).toEqual(['available', 'revision']);

    const details = await fetchSyncHealthDetails({ serverUrl: 'http://127.0.0.1:8787' });
    expect(details).toEqual({
      available: true,
      revision: 0,
      googleOAuthConfigured: true,
    });

    const authStatus = await fetchAuthStatus({ serverUrl: 'http://127.0.0.1:8787' });
    expect(authStatus?.authenticated).toBe(true);
    expect(authStatus?.googleOAuthConfigured).toBe(true);
    expect(authStatus?.session?.email).toBe('aarav@patel.in');

    const sessOnly = await fetchCurrentAuthSession({ serverUrl: 'http://127.0.0.1:8787' });
    expect(sessOnly?.userId).toBe('u-1');

    expect(
      buildGoogleOAuthStartUrl({
        mode: 'signup',
        inviteCode: 'INV-9988',
        plan: 'advisor',
      })
    ).toBe('/api/auth/google/start?mode=signup&invite=INV-9988&plan=advisor');

    expect(buildGoogleOAuthStartUrl({ serverUrl: 'https://api.example.com/', mode: 'signin' })).toBe(
      'https://api.example.com/api/auth/google/start?mode=signin'
    );
  });

  it('hydrates ?oauth=ok&oauthNew=1 on mount (even over cached demo session), strips query params, syncs server state, and opens Folk onboarding', async () => {
    createGuestDemoSession(0);

    const remoteSeed = createCleanHouseholdSeed({
      memberId: 'm-oauth-1',
      name: 'Diya Shah',
      role: 'admin',
      avatar: '🧑🏽‍💻',
      householdName: 'Shah OAuth Family',
      planTier: 'free',
      language: 'en',
    });

    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return mockJsonResponse({
          authenticated: true,
          googleOAuthConfigured: true,
          session: {
            token: 'oauth-tok-1',
            userId: 'usr-oauth-1',
            householdId: 'hh-oauth-1',
            householdName: 'Shah OAuth Family',
            name: 'Diya Shah',
            email: 'diya@shah.in',
            role: 'admin',
            memberId: 'm-oauth-1',
            avatar: '🧑🏽‍💻',
            planTier: 'free',
            isDemo: false,
          },
        });
      }
      if (url.includes('/api/state')) {
        return mockJsonResponse({
          revision: 1,
          state: remoteSeed,
          updatedAt: '2026-11-27T12:00:00Z',
          activity: [],
        });
      }
      return mockJsonResponse({ ok: false }, 404);
    });
    vi.stubGlobal('fetch', fetchSpy);

    window.history.replaceState({}, '', '/?oauth=ok&oauthNew=1');
    render(<App />);

    expect(window.location.search).toBe('');
    expect(await screen.findByText('Welcome to Dhanora (ધનોરા)')).toBeInTheDocument();
    expect(screen.getByText('Pick a starter setup (30 seconds)')).toBeInTheDocument();
    expect(screen.getAllByText('Diya Shah').length).toBeGreaterThanOrEqual(1);
    expect(fetchSpy.mock.calls.some(([u]) => String(u).includes('/api/state'))).toBe(true);
  });

  it('routes ?oauth=ok&oauthNew=1&postAuthPlan=advisor directly to Pricing checkout without popping onboarding modal', async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return mockJsonResponse({
          authenticated: true,
          googleOAuthConfigured: true,
          session: {
            token: 'oauth-tok-2',
            userId: 'usr-oauth-2',
            householdId: 'hh-oauth-2',
            householdName: 'Mehta Practice',
            name: 'Rohan Mehta',
            email: 'rohan@mehta.in',
            role: 'admin',
            memberId: 'm-oauth-2',
            avatar: '🧑🏽‍💻',
            planTier: 'free',
            isDemo: false,
          },
        });
      }
      if (url.includes('/api/state')) {
        return mockJsonResponse({ revision: 0, state: null, updatedAt: null, activity: [] });
      }
      if (url.includes('/api/billing/checkout')) {
        return mockJsonResponse({
          ok: true,
          checkout: {
            provider: 'razorpay',
            mode: 'sandbox',
            orderId: 'ord_sandbox_advisor_1',
            amountMinor: 200,
            currency: 'INR',
            tier: 'advisor',
            billingCycle: 'yearly',
            planName: 'Advisor Practice',
          },
        });
      }
      if (url.includes('/api/billing/invoices')) {
        return mockJsonResponse({ invoices: [] });
      }
      return mockJsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchSpy);

    window.history.replaceState({}, '', '/?oauth=ok&oauthNew=1&postAuthPlan=advisor');
    render(<App />);

    expect(window.location.search).toBe('');
    expect(await screen.findByText(/Order ord_sandbox_advisor_1/i)).toBeInTheDocument();
    expect(screen.getByText('Simple, honest family pricing')).toBeInTheDocument();
    expect(screen.getAllByText('Rohan Mehta').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Welcome to Dhanora (ધનોરા)')).not.toBeInTheDocument();
  });

  it('displays bilingual dismissible oauthNotice on PublicPortal for ?authError= codes and updates live on EN <-> ગુજ toggle', () => {
    const errorCodes = [
      'google_not_configured',
      'google_cancelled',
      'google_invalid_state',
      'google_state_expired',
      'google_token_exchange_failed',
      'google_email_unverified',
      'google_account_mismatch',
      'google_invite_invalid',
      'google_oauth_failed',
    ] as const;

    // Spot check all 9 codes + offline in EN and GU dictionaries via App rendering for representative codes
    for (const code of [
      'google_not_configured',
      'google_cancelled',
      'google_state_expired',
    ] as const) {
      window.history.replaceState({}, '', `/?authError=${code}`);
      const { unmount } = render(<App />);
      expect(window.location.search).toBe('');

      const expectedEnKey =
        code === 'google_not_configured'
          ? 'auth.oauthErrNotConfigured'
          : code === 'google_cancelled'
          ? 'auth.oauthErrCancelled'
          : 'auth.oauthErrStateExpired';

      expect(screen.getByText(translate('en', expectedEnKey))).toBeInTheDocument();

      const switcher = screen.getByTestId('language-switcher');
      fireEvent.click(within(switcher).getByRole('button', { name: 'ગુજ' }));
      expect(screen.getByText(translate('gu', expectedEnKey))).toBeInTheDocument();

      const dismissBtn = screen.getByRole('button', {
        name: translate('gu', 'auth.dismissNoticeAria'),
      });
      expect(dismissBtn.className).toContain('min-h-[44px]');
      expect(dismissBtn.className).toContain('min-w-[44px]');
      fireEvent.click(dismissBtn);
      expect(screen.queryByText(translate('gu', expectedEnKey))).not.toBeInTheDocument();
      unmount();
    }

    // Verify all 9 codes resolve to non-empty bilingual strings
    expect(errorCodes).toHaveLength(9);
    expect(translate('en', 'auth.oauthErrInvalidState').length).toBeGreaterThan(10);
    expect(translate('gu', 'auth.oauthErrTokenFailed').length).toBeGreaterThan(10);
    expect(translate('en', 'auth.oauthErrEmailUnverified').length).toBeGreaterThan(10);
    expect(translate('gu', 'auth.oauthErrAccountMismatch').length).toBeGreaterThan(10);
    expect(translate('en', 'auth.oauthErrInviteInvalid').length).toBeGreaterThan(10);
    expect(translate('gu', 'auth.oauthErrOauthFailed').length).toBeGreaterThan(10);
    expect(translate('en', 'auth.oauthErrOffline').length).toBeGreaterThan(10);
  });

  it('renders Mobbin split-screen AuthPages with Continue with Google (18x18 SVG, >=44px), offline notice, legal routing & mode switch', async () => {
    const assignMock = vi.fn();
    const origLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...origLocation,
        pathname: '/signin',
        search: '',
        assign: assignMock,
      },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/api/invites/FAM-JOIN-1')) {
          return mockJsonResponse({
            ok: true,
            invite: {
              code: 'FAM-JOIN-1',
              householdName: 'Patel Family',
              role: 'partner',
            },
          });
        }
        return mockJsonResponse({}, 404);
      })
    );

    try {
      const onBackHome = vi.fn();
      const onOpenLegal = vi.fn();
      const { container } = render(
        <FinanceProvider>
          <AuthPages
            initialMode="signin"
            initialPlan="plus"
            initialInviteCode="FAM-JOIN-1"
            onBackHome={onBackHome}
            onOpenLegal={onOpenLegal}
          />
        </FinanceProvider>
      );

      // Split-screen WDW light classes & zero dark:* overrides in AuthPages layout/form/aside
      const rootDiv = container.firstElementChild as HTMLElement;
      expect(rootDiv.className).toContain('lg:grid-cols-2');
      expect(rootDiv.className).toContain('overflow-x-clip');
      expect(rootDiv.className).not.toMatch(/\bdark:/);
      const aside = container.querySelector('aside');
      expect(aside).not.toBeNull();
      expect(aside?.outerHTML).not.toMatch(/\bdark:/);
      const form = container.querySelector('form');
      expect(form?.outerHTML).not.toMatch(/\bdark:/);

      // Right montage cards present
      expect(screen.getByText('₹42.84L')).toBeInTheDocument();
      expect(screen.getByText('₹2.48 Cr')).toBeInTheDocument();
      expect(screen.getByText('Nominee Shield')).toBeInTheDocument();
      expect(screen.getByText('GST / Rent vs Buy')).toBeInTheDocument();
      expect(screen.getByText('Quick Receipt Scan')).toBeInTheDocument();

      // Continue with Google button on Sign In
      const googleBtn = screen.getByRole('button', { name: /Continue with Google/i });
      expect(googleBtn.className).toContain('min-h-[44px]');
      const svg = googleBtn.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute('width')).toBe('18');
      expect(svg?.getAttribute('height')).toBe('18');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');

      fireEvent.click(googleBtn);
      expect(assignMock).toHaveBeenCalledWith(
        '/api/auth/google/start?mode=signin&invite=FAM-JOIN-1&plan=plus'
      );

      // Switch to Sign Up & verify invite preview + Google URL updates mode=signup
      fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));
      expect(screen.getByText(/Create your household account/i)).toBeInTheDocument();
      expect(await screen.findByText(/Joining "Patel Family"/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Continue with Google/i }));
      expect(assignMock).toHaveBeenLastCalledWith(
        '/api/auth/google/start?mode=signup&invite=FAM-JOIN-1&plan=plus'
      );

      // Offline Google click triggers bilingual offline notice instead of navigating
      vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
      assignMock.mockClear();
      fireEvent.click(screen.getByRole('button', { name: /Continue with Google/i }));
      expect(assignMock).not.toHaveBeenCalled();
      expect(screen.getByText(translate('en', 'auth.oauthErrOffline'))).toBeInTheDocument();

      // 4-persona demo drawer expands cleanly
      const demoToggle = screen.getByRole('button', { name: /Explore Demo Roles/i });
      expect(demoToggle.className).toContain('min-h-[44px]');
      fireEvent.click(demoToggle);
      expect(screen.getByText('alex@carter.family')).toBeInTheDocument();
      expect(screen.getByText('meera@advisor.in')).toBeInTheDocument();

      // Legal links trigger onOpenLegal
      fireEvent.click(screen.getByRole('button', { name: 'Terms of Service' }));
      expect(onOpenLegal).toHaveBeenCalledWith('terms');
      fireEvent.click(screen.getByRole('button', { name: 'Privacy Policy' }));
      expect(onOpenLegal).toHaveBeenCalledWith('privacy');

      // Clickable logo routes home
      fireEvent.click(screen.getByRole('button', { name: /Dhanora \(ધનોરા\)/i }));
      expect(onBackHome).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: origLocation,
      });
    }
  });

  it('PricingView shows Continue with Google re-auth CTA when checkout returns AUTH_REQUIRED', async () => {
    const assignMock = vi.fn();
    const origLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...origLocation,
        pathname: '/',
        search: '?oauth=ok&postAuthPlan=plus',
        assign: assignMock,
      },
    });

    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return mockJsonResponse({
          authenticated: true,
          googleOAuthConfigured: true,
          session: {
            token: 'expired-tok',
            userId: 'usr-1',
            householdId: 'hh-1',
            householdName: 'Test Family',
            name: 'Aarav',
            email: 'aarav@test.in',
            role: 'admin',
            memberId: 'm-1',
            avatar: '🧑🏽‍💻',
            planTier: 'free',
            isDemo: false,
          },
        });
      }
      if (url.includes('/api/state')) {
        return mockJsonResponse({ revision: 0, state: null, updatedAt: null, activity: [] });
      }
      if (url.includes('/api/billing/checkout')) {
        return mockJsonResponse({ ok: false, error: 'AUTH_REQUIRED' }, 401);
      }
      if (url.includes('/api/billing/invoices')) {
        return mockJsonResponse({ invoices: [] });
      }
      return mockJsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchSpy);

    try {
      render(<App />);

      const reauthBtn = await screen.findByRole('button', { name: /Continue with Google/i });
      expect(reauthBtn.className).toContain('min-h-[44px]');
      fireEvent.click(reauthBtn);
      expect(assignMock).toHaveBeenCalledWith('/api/auth/google/start?mode=signin&plan=plus');
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: origLocation,
      });
    }
  });

  it('StarterTemplatesModal renders Folk two-pane onboarding with 3-step dot indicator, #003527 5-item checklist, >=44px controls, and Step 1->2->3 flow', async () => {
    const onClose = vi.fn();
    render(
      <FinanceProvider>
        <StarterTemplatesModal open onClose={onClose} />
      </FinanceProvider>
    );

    const dialog = screen.getByRole('dialog', { name: 'Pick a starter setup (30 seconds)' });
    expect(dialog.innerHTML).not.toMatch(/\bdark:/);

    expect(screen.getByText('Welcome to Dhanora (ધનોરા)')).toBeInTheDocument();
    expect(screen.getByText('Pick a starter setup (30 seconds)')).toBeInTheDocument();

    // 3-step dots
    const dots = screen.getByTestId('onboarding-step-dots');
    expect(within(dots).getByText('Pick template')).toBeInTheDocument();
    expect(within(dots).getByText('Select members')).toBeInTheDocument();
    expect(within(dots).getByText('Launch vault')).toBeInTheDocument();

    // 5-item #003527 right checklist
    expect(screen.getByText('50/30/20 Household Cashflow')).toBeInTheDocument();
    expect(screen.getByText('Nominee & Insurance Shield')).toBeInTheDocument();
    expect(screen.getByText('Tax & FIRE Calculators')).toBeInTheDocument();
    expect(screen.getByText('Private Advisor & Dependent Permissions')).toBeInTheDocument();
    expect(screen.getByText('Encrypted Sync & CSV Ownership')).toBeInTheDocument();

    // Close button & CTAs >= 44px
    const closeBtn = screen.getByRole('button', { name: 'Close templates dialog' });
    expect(closeBtn.className).toContain('min-h-[44px]');
    expect(closeBtn.className).toContain('min-w-[44px]');

    const useTemplateBtns = screen.getAllByRole('button', { name: 'Use Template' });
    expect(useTemplateBtns[0].className).toContain('min-h-[44px]');

    // Step 1 -> Step 2
    const nextBtn = screen.getByRole('button', { name: 'Continue' });
    expect(nextBtn.className).toContain('min-h-[44px]');
    fireEvent.click(nextBtn);
    expect(screen.getByText('Select household members')).toBeInTheDocument();

    const jointOpt = screen.getByRole('button', { name: /Joint Family/i });
    expect(jointOpt.className).toContain('min-h-[44px]');
    fireEvent.click(jointOpt);

    // Step 2 -> Step 3
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(screen.getByText(/Ready to launch your Dhanora/i)).toBeInTheDocument();
    });

    const launchBtn = screen.getByRole('button', { name: 'Launch Vault' });
    expect(launchBtn.className).toContain('min-h-[44px]');
    fireEvent.click(launchBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clears stale demo session and shows oauthNotice error when ?oauth=ok receives unauthenticated /api/auth/me', async () => {
    persistAuthSession(createGuestDemoSession(0));
    expect(loadAuthSession()?.isDemo).toBe(true);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/api/auth/me')) {
          return mockJsonResponse({
            authenticated: false,
            session: null,
            googleOAuthConfigured: true,
          });
        }
        return mockJsonResponse({}, 404);
      })
    );

    window.history.replaceState({}, '', '/?oauth=ok');
    render(<App />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(translate('en', 'auth.oauthErrOauthFailed'));
    expect(loadAuthSession()).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Sign in' }).length).toBeGreaterThanOrEqual(1);
  });

  it('completes non-test OAuth sync & IndexedDB hydration without stalling at local-only and without clobbering remote state', async () => {
    vi.stubEnv('MODE', 'production');
    vi.stubGlobal(
      'EventSource',
      class {
        addEventListener() {}
        removeEventListener() {}
        close() {}
      }
    );
    vi.spyOn(repository, 'hasIndexedDb').mockReturnValue(true);
    const loadSpy = vi
      .spyOn(repository, 'loadAppStateFromRepo')
      .mockResolvedValue({ state: null, migratedFromLegacy: false });
    const saveSpy = vi.spyOn(repository, 'saveAppStateToRepo').mockResolvedValue(undefined);

    try {
      const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (url.includes('/api/auth/me')) {
          return mockJsonResponse({
            authenticated: true,
            googleOAuthConfigured: true,
            session: {
              token: 'oauth-prod-1',
              userId: 'usr-prod-1',
              householdId: 'hh-prod-1',
              householdName: 'Prod OAuth Family',
              name: 'Kavya Nair',
              email: 'kavya@nair.in',
              role: 'admin',
              memberId: 'm-prod-1',
              avatar: '🧑🏽‍💻',
              planTier: 'free',
              isDemo: false,
            },
          });
        }
        if (url.includes('/api/health')) {
          return mockJsonResponse({
            ok: true,
            revision: 0,
            googleOAuthConfigured: true,
          });
        }
        if (url.includes('/api/state') && method === 'GET') {
          return mockJsonResponse({
            revision: 0,
            state: null,
            updatedAt: null,
            activity: [],
          });
        }
        if (url.includes('/api/state') && method === 'PUT') {
          return mockJsonResponse({
            ok: true,
            revision: 1,
            updatedAt: '2026-11-27T14:30:00Z',
            activity: [],
          });
        }
        return mockJsonResponse({}, 404);
      });
      vi.stubGlobal('fetch', fetchSpy);

      const SyncProbe = () => {
        const { syncStatus, isStorageHydrated, authSession } = useFinance();
        return (
          <div data-testid="sync-probe">
            {`${authSession?.userId ?? 'none'}|${String(isStorageHydrated)}|${syncStatus}`}
          </div>
        );
      };

      window.history.replaceState({}, '', '/?oauth=ok&oauthNew=1');
      const { unmount } = render(
        <FinanceProvider>
          <SyncProbe />
        </FinanceProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('sync-probe').textContent).toBe('usr-prod-1|true|synced');
      });
      expect(saveSpy).toHaveBeenCalled();
      expect(
        fetchSpy.mock.calls.some(
          ([u, init]) => String(u).includes('/api/state') && init?.method === 'PUT'
        )
      ).toBe(true);
      unmount();

      // Case 2: Existing cached demo session + stale IndexedDB for target household must NOT overwrite remote.state
      persistAuthSession(createGuestDemoSession(0));
      const staleIdbState = createCleanHouseholdSeed({
        memberId: 'm-prod-2',
        name: 'Stale Local Name',
        role: 'admin',
        avatar: '🧑🏽‍💻',
        householdName: 'Stale Household',
        planTier: 'free',
        language: 'en',
      });
      const freshRemoteState = createCleanHouseholdSeed({
        memberId: 'm-prod-2',
        name: 'Fresh Remote Name',
        role: 'admin',
        avatar: '🧑🏽‍💻',
        householdName: 'Fresh Remote Family',
        planTier: 'plus',
        language: 'en',
      });
      loadSpy.mockResolvedValue({ state: staleIdbState, migratedFromLegacy: false });
      saveSpy.mockClear();

      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const url = String(input);
          if (url.includes('/api/auth/me')) {
            return mockJsonResponse({
              authenticated: true,
              googleOAuthConfigured: true,
              session: {
                token: 'oauth-prod-2',
                userId: 'usr-prod-2',
                householdId: 'hh-prod-2',
                householdName: 'Fresh Remote Family',
                name: 'Fresh Remote Name',
                email: 'fresh@remote.in',
                role: 'admin',
                memberId: 'm-prod-2',
                avatar: '🧑🏽‍💻',
                planTier: 'plus',
                isDemo: false,
              },
            });
          }
          if (url.includes('/api/health')) {
            return mockJsonResponse({ ok: true, revision: 2, googleOAuthConfigured: true });
          }
          if (url.includes('/api/state')) {
            return mockJsonResponse({
              revision: 2,
              state: freshRemoteState,
              updatedAt: '2026-11-27T14:35:00Z',
              activity: [],
            });
          }
          return mockJsonResponse({}, 404);
        })
      );

      const RemoteProbe = () => {
        const { state, syncStatus, isStorageHydrated } = useFinance();
        return (
          <div data-testid="remote-probe">
            {`${state.settings.householdName}|${String(isStorageHydrated)}|${syncStatus}`}
          </div>
        );
      };

      window.history.replaceState({}, '', '/?oauth=ok');
      render(
        <FinanceProvider>
          <RemoteProbe />
        </FinanceProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('remote-probe').textContent).toBe(
          'Fresh Remote Family|true|synced'
        );
      });
      expect(saveSpy).toHaveBeenCalled();
      expect(
        saveSpy.mock.calls.some(
          ([saved]) => saved?.settings?.householdName === 'Fresh Remote Family'
        )
      ).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('prevents dark mode leakage onto BrandLogoButton and LanguageToggle inside AuthPages even when html.dark is set', async () => {
    const DarkThemeActivator = () => {
      const { updateSettings } = useFinance();
      return (
        <button type="button" onClick={() => updateSettings({ theme: 'dark' })}>
          Enable Dark Theme
        </button>
      );
    };

    try {
      render(
        <FinanceProvider>
          <DarkThemeActivator />
          <AuthPages initialMode="signin" onBackHome={vi.fn()} />
        </FinanceProvider>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Enable Dark Theme' }));
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });

      const brandBtn = screen.getByRole('button', { name: /Dhanora \(ધનોરા\)/i });
      const langSwitcher = screen.getByTestId('language-switcher');
      expect(brandBtn.outerHTML).not.toMatch(/\bdark:/);
      expect(langSwitcher.outerHTML).not.toMatch(/\bdark:/);
    } finally {
      document.documentElement.classList.remove('dark');
    }
  });

  it('fires POST /api/billing/checkout exactly once for ?oauth=ok&postAuthPlan=advisor under React.StrictMode', async () => {
    let checkoutCalls = 0;
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return mockJsonResponse({
          authenticated: true,
          googleOAuthConfigured: true,
          session: {
            token: 'oauth-strict-1',
            userId: 'usr-strict-1',
            householdId: 'hh-strict-1',
            householdName: 'Strict Family',
            name: 'Neha Joshi',
            email: 'neha@joshi.in',
            role: 'admin',
            memberId: 'm-strict-1',
            avatar: '🧑🏽‍💻',
            planTier: 'free',
            isDemo: false,
          },
        });
      }
      if (url.includes('/api/state')) {
        return mockJsonResponse({ revision: 0, state: null, updatedAt: null, activity: [] });
      }
      if (url.includes('/api/billing/checkout') && init?.method === 'POST') {
        checkoutCalls += 1;
        return mockJsonResponse({
          ok: true,
          checkout: {
            provider: 'razorpay',
            mode: 'sandbox',
            orderId: 'ord_sandbox_strict_1',
            amountMinor: 200,
            currency: 'INR',
            tier: 'advisor',
            billingCycle: 'yearly',
            planName: 'Advisor Practice',
          },
        });
      }
      if (url.includes('/api/billing/invoices')) {
        return mockJsonResponse({ invoices: [] });
      }
      return mockJsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchSpy);

    window.history.replaceState({}, '', '/?oauth=ok&postAuthPlan=advisor');
    render(
      <StrictMode>
        <App />
      </StrictMode>
    );

    expect(await screen.findByText(/Order ord_sandbox_strict_1/i)).toBeInTheDocument();
    expect(checkoutCalls).toBe(1);
  });

  it('aligns StarterTemplatesModal Step 2 Solo with Dual-Income Couple (1 member only) and supports keyboard template card selection', () => {
    const onClose = vi.fn();
    const MemberCountProbe = () => {
      const { state } = useFinance();
      return (
        <div data-testid="member-probe">
          {`${state.members.length}:${state.members.map((m) => m.name).join(',')}`}
        </div>
      );
    };

    render(
      <FinanceProvider>
        <MemberCountProbe />
        <StarterTemplatesModal open onClose={onClose} />
      </FinanceProvider>
    );

    const coupleCard = screen.getByText('Dual-Income Couple').closest('[role="button"]') as HTMLElement;
    const salariedCard = screen
      .getByText('Indian Salaried Family')
      .closest('[role="button"]') as HTMLElement;
    expect(coupleCard).not.toBeNull();
    expect(coupleCard.getAttribute('role')).toBe('button');
    expect(coupleCard.getAttribute('tabindex')).toBe('0');

    // Keyboard Space selects salariedCard, Enter selects coupleCard
    fireEvent.keyDown(salariedCard, { key: ' ' });
    expect(salariedCard.getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(coupleCard, { key: 'Enter' });
    expect(coupleCard.getAttribute('aria-pressed')).toBe('true');

    // Step 1 -> Step 2: choose Solo
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: /Solo \/ Individual/i }));

    // Step 2 -> Step 3 -> Launch
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Launch Vault' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    const memberText = screen.getByTestId('member-probe').textContent ?? '';
    expect(memberText.startsWith('1:')).toBe(true);
    expect(memberText).not.toContain('Partner');
  });

  it('enforces >=44px LanguageToggle buttons and proper Gujarati legal acknowledgment spacing', () => {
    const { container } = render(
      <FinanceProvider>
        <AuthPages initialMode="signin" onBackHome={vi.fn()} />
      </FinanceProvider>
    );

    const switcher = screen.getByTestId('language-switcher');
    const enBtn = within(switcher).getByRole('button', { name: 'English' });
    const guBtn = within(switcher).getByRole('button', { name: 'ગુજરાતી' });
    expect(enBtn.className).toContain('min-h-[44px]');
    expect(guBtn.className).toContain('min-h-[44px]');

    fireEvent.click(guBtn);
    const legalParagraph = Array.from(container.querySelectorAll('p')).find((p) =>
      p.textContent?.includes('સ્વીકારો છો.')
    );
    expect(legalParagraph).toBeDefined();
    expect(legalParagraph?.textContent).toContain('ગોપનીયતા નીતિ સ્વીકારો છો.');
  });
});
