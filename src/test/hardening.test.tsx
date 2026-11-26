import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { parseCsvText, mapCsvRowsToTransactions } from '../utils/csv';
import { createSeedState } from '../data/seed';
import { resetMemoryFallbackForTests } from '../storage/repository';
import { createGuestDemoSession } from '../utils/auth';

describe('UX Polish, PWA & Hardening', () => {
  beforeEach(() => {
    localStorage.clear();
    resetMemoryFallbackForTests();
    createGuestDemoSession(0);
  });

  it('opens Command Palette via Ctrl+K, navigates views, and closes on Escape', async () => {
    render(<App />);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const searchInput = screen.getByLabelText('Command palette search');
    expect(searchInput).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'Budgets' } });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(await screen.findByText(/Monthly Budgets & 50\/30\/20 Planner/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Command palette search')).not.toBeInTheDocument();

    // Reopen and close with Escape
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByLabelText('Command palette search')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByLabelText('Command palette search')).not.toBeInTheDocument();
  });

  it('closes QuickAddModal on Escape key', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Add Transaction/i }));
    expect(screen.getByText('Record Family Transaction')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Record Family Transaction')).not.toBeInTheDocument();
  });

  it('shows Undo toast when deleting a transaction and restores it on Undo', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Transactions/i }));

    expect(await screen.findByText('Costco Wholesale')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Costco Wholesale' }));

    expect(screen.queryByText('Costco Wholesale')).not.toBeInTheDocument();
    expect(screen.getByText(/Deleted 1 transaction/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Undo/i }));
    expect(screen.getByText('Costco Wholesale')).toBeInTheDocument();
  });

  it('displays Offline badge when browser goes offline and hides it back online', () => {
    render(<App />);
    expect(screen.queryByText('Offline')).not.toBeInTheDocument();

    fireEvent(window, new Event('offline'));
    expect(screen.getByText('Offline')).toBeInTheDocument();

    fireEvent(window, new Event('online'));
    expect(screen.queryByText('Offline')).not.toBeInTheDocument();
  });

  it('handles quoted commas, escaped quotes, and invalid rows in CSV import', () => {
    const rawCsv = [
      'Date,Merchant,Amount,Type,Note',
      '2026-11-10,"Market, Fresh ""Organic""",-48.75,expense,"Bought ""apples, pears"""',
      'invalid-date,Broken Row,not-a-number,expense,skip me',
      '2026-11-12,Freelance Client,350,income,Web audit',
    ].join('\n');

    const rows = parseCsvText(rawCsv);
    expect(rows.length).toBe(4);
    expect(rows[1][1]).toBe('Market, Fresh "Organic"');
    expect(rows[1][4]).toBe('Bought "apples, pears"');

    const seed = createSeedState();
    const mapped = mapCsvRowsToTransactions(
      rows.slice(1),
      { dateCol: 0, merchantCol: 1, amountCol: 2, typeCol: 3, categoryCol: -1, noteCol: 4 },
      {
        accountId: 'acc-joint',
        memberId: 'm-alex',
        baseCurrency: 'USD',
        exchangeRates: seed.settings.exchangeRates,
        categories: seed.categories,
      }
    );

    expect(mapped.length).toBe(2);
    expect(mapped[0].type).toBe('expense');
    expect(mapped[0].amount).toBe(48.75);
    expect(mapped[1].type).toBe('income');
    expect(mapped[1].amount).toBe(350);
  });
});
