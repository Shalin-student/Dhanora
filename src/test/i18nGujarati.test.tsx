import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { createSeedState } from '../data/seed';
import {
  localizeAccountType,
  localizeCategoryName,
  localizeFrequency,
  localizeMonthLabel,
  localizeRole,
  localizeShortDay,
  translate,
  TRANSLATIONS,
} from '../i18n';
import { resetMemoryFallbackForTests } from '../storage/repository';
import { createGuestDemoSession } from '../utils/auth';
import { detectFinancialAnomalies } from '../utils/automation';
import { computeFinancialHealthScore } from '../utils/calculations';

describe('Gujarati i18n Dictionaries & Localizers (Unit)', () => {
  it('ensures every translation key provides both non-empty English and Gujarati text', () => {
    for (const [key, entry] of Object.entries(TRANSLATIONS)) {
      expect(entry.en.trim().length, `Missing EN for ${key}`).toBeGreaterThan(0);
      expect(entry.gu.trim().length, `Missing GU for ${key}`).toBeGreaterThan(0);
    }
  });

  it('localizes months, dates, categories, roles, account types, frequencies, health insights & anomalies into Gujarati', () => {
    expect(localizeMonthLabel('2026-11', 'gu')).toBe('નવે 2026');
    expect(localizeMonthLabel('2026-11', 'gu', true)).toBe('નવેમ્બર 2026');
    expect(localizeShortDay('2026-01-15', 'gu')).toBe('15 જાન્યુ');

    expect(localizeCategoryName({ name: 'Groceries & Pantry' }, 'gu')).toBe('કરિયાણું અને રાશન');
    expect(localizeCategoryName({ name: 'Custom Vacation' }, 'gu')).toBe('Custom Vacation');

    expect(localizeRole('admin', 'gu')).toBe('એડમિન');
    expect(localizeRole('partner', 'gu')).toBe('ભાગીદાર');
    expect(localizeRole('dependent', 'gu')).toBe('આશ્રિત');

    expect(localizeAccountType('checking', 'gu')).toBe('ચેકિંગ / બેંક ખાતું');
    expect(localizeFrequency('monthly', 'gu')).toBe('માસિક');

    const seed = createSeedState();
    const healthGu = computeFinancialHealthScore(seed, seed.transactions[0].date.slice(0, 7), 'gu');
    expect(healthGu.insights.length).toBeGreaterThan(0);
    expect(/[\u0A80-\u0AFF]/.test(healthGu.insights[0])).toBe(true);

    const spikedState = {
      ...seed,
      recurring: [
        ...seed.recurring,
        {
          id: 'rec-hike',
          title: 'Gym Club',
          type: 'expense' as const,
          amount: 150,
          currency: 'USD' as const,
          frequency: 'monthly' as const,
          nextDueDate: '2026-11-28',
          categoryId: 'cat-health',
          accountId: 'acc-joint',
          memberId: 'm-alex',
          autoPost: false,
          isActive: true,
        },
      ],
      transactions: [
        ...seed.transactions,
        {
          id: 'tx-gym-old',
          type: 'expense' as const,
          amount: 80,
          currency: 'USD' as const,
          baseAmount: 80,
          date: '2026-10-05',
          merchant: 'Gym Club',
          categoryId: 'cat-health',
          accountId: 'acc-joint',
          memberId: 'm-alex',
          tags: [],
          note: '',
          status: 'cleared' as const,
          createdAt: '2026-10-05T10:00:00Z',
        },
      ],
    };
    const alertsGu = detectFinancialAnomalies(spikedState, '2026-11', '2026-11-29', 'gu');
    expect(alertsGu.some((a) => a.title.includes('નિયમિત રકમમાં વધારો'))).toBe(true);
    expect(translate('gu', 'nav.dashboard')).toBe('મુખ્ય ઝાંખી');
  });
});

describe('English / Gujarati Split Language Switcher UI', () => {
  beforeEach(() => {
    localStorage.clear();
    resetMemoryFallbackForTests();
    createGuestDemoSession(0);
    document.documentElement.lang = 'en';
  });

  it('switches the entire website cleanly to Gujarati and back to English with one click', async () => {
    render(<App />);
    expect(screen.getByText('Household Financial Pulse')).toBeInTheDocument();

    const switcher = screen.getByTestId('language-switcher');
    fireEvent.click(within(switcher).getByRole('button', { name: 'ગુજ' }));

    expect(await screen.findByText('પરિવારની આર્થિક સ્થિતિ')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('gu');
    expect(screen.getByText('માસિક આવક')).toBeInTheDocument();
    expect(screen.getByText('માસિક ખર્ચ')).toBeInTheDocument();
    expect(screen.getByText('ચોખ્ખો રોકડ પ્રવાહ')).toBeInTheDocument();
    expect(screen.getByText('પરિવારની કુલ સંપત્તિ')).toBeInTheDocument();
    expect(screen.getByText('90 દિવસની બેલેન્સ આગાહી')).toBeInTheDocument();
    expect(screen.getByText('આર્થિક સ્વાસ્થ્ય સ્કોર')).toBeInTheDocument();

    // Sidebar translated into clean Gujarati
    expect(screen.getByRole('button', { name: 'મુખ્ય ઝાંખી' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'વ્યવહારો' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'રસીદ તિજોરી' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'બજેટ અને 50/30/20' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'સેટિંગ્સ' })).toBeInTheDocument();

    // Quick Entry Modal renders in Gujarati & saves with Gujarati toast
    fireEvent.click(screen.getByRole('button', { name: /વ્યવહાર ઉમેરો/i }));
    expect(screen.getByText('પરિવારનો વ્યવહાર નોંધો')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '125' } });
    fireEvent.change(screen.getByPlaceholderText(/દા.ત. કરિયાણા સ્ટોર/i), {
      target: { value: 'અમદાવાદ સુપરમાર્ટ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'વ્યવહાર સાચવો' }));
    expect(screen.getByText(/"અમદાવાદ સુપરમાર્ટ" સાચવ્યું/i)).toBeInTheDocument();

    // Navigate through key views in Gujarati
    fireEvent.click(screen.getByRole('button', { name: 'વ્યવહારો' }));
    expect(await screen.findByText('વ્યવહારોની ખાતાવહી')).toBeInTheDocument();
    expect(screen.getByText('અમદાવાદ સુપરમાર્ટ')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'બજેટ અને 50/30/20' }));
    expect(await screen.findByText('માસિક બજેટ અને 50/30/20 આયોજક')).toBeInTheDocument();
    expect(screen.getByText('ખર્ચની ગતિ')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'નિયમિત બિલ અને પગાર' }));
    expect(
      await screen.findByText('નિયમિત બિલ, સબ્સ્ક્રિપ્શન અને પગાર')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ઓટોમેશન અને નિયમો' }));
    expect(
      await screen.findByText('સ્માર્ટ ઓટોમેશન, નિયમો અને ચેતવણીઓ')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'બચત લક્ષ્યો અને દેવું' }));
    expect(
      await screen.findByText('બચત લક્ષ્યો, ભંડોળ અને લોન ચુકવણી')
    ).toBeInTheDocument();
    expect(
      screen.getByText('સ્નોબોલ વિરુદ્ધ એવલાન્ચ લોન પતાવટ સિમ્યુલેટર')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ખાતા અને કુલ સંપત્તિ' }));
    expect(
      await screen.findByText('ખાતા, વૉલેટ અને કુલ સંપત્તિ')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'પરિવાર અને ભાગલા' }));
    expect(
      await screen.findByText('પરિવારના સભ્યો, ભથ્થાં અને બિલ ભાગલા')
    ).toBeInTheDocument();
    expect(screen.getByText('પરિવારિક પ્રવૃત્તિ ઓડિટ નોંધ')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'રિપોર્ટ અને નિકાસ' }));
    expect(
      await screen.findByText('માસિક સ્ટેટમેન્ટ, હીટમેપ અને વિશ્લેષણ')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'સેટિંગ્સ' }));
    expect(
      await screen.findByText('પરિવાર સેટિંગ્સ, સુરક્ષા અને ડેટાબેઝ તિજોરી')
    ).toBeInTheDocument();

    // Test lock-screen in Gujarati + language split toggle directly on lock screen
    fireEvent.change(screen.getByLabelText('નવો પરિવાર PIN'), { target: { value: '2580' } });
    fireEvent.change(screen.getByLabelText('પરિવાર PIN ફરી દાખલ કરો'), {
      target: { value: '2580' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'PIN લૉક ચાલુ કરો' }));
    await waitFor(() => {
      expect(screen.getByText('SHA-256 સક્રિય')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'પરિવાર ખાતાવહી લૉક કરો' }));
    expect(screen.getByText('અનલૉક કરવા પરિવારનો PIN દાખલ કરો')).toBeInTheDocument();

    // Flip back to English directly from the PIN Lock Screen!
    const lockSwitcher = screen.getByTestId('language-switcher');
    fireEvent.click(within(lockSwitcher).getByRole('button', { name: 'English' }));
    expect(screen.getByText('Enter household PIN to unlock')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');

    // Unlock and verify English Dashboard restored
    fireEvent.change(screen.getByLabelText('Household PIN'), { target: { value: '2580' } });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock Ledger' }));
    expect(await screen.findByText('પરિવારની આર્થિક સ્થિતિ', {}, { timeout: 200 }).catch(() => null)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    expect(await screen.findByText('Household Financial Pulse')).toBeInTheDocument();
  }, 15000);
});
