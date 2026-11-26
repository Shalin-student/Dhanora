import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { createSeedState } from '../data/seed';
import {
  getReceiptRecord,
  LEGACY_LOCALSTORAGE_KEY,
  loadAppStateFromRepo,
  resetMemoryFallbackForTests,
  sanitizeAndMigrateState,
} from '../storage/repository';
import { estimateDataUrlBytes, formatBytes } from '../utils/image';
import { createPinCredentials, verifyPinAgainstSettings } from '../utils/security';
import { createGuestDemoSession } from '../utils/auth';

describe('Crypto PIN Security & Storage Migration', () => {
  beforeEach(() => {
    localStorage.clear();
    resetMemoryFallbackForTests();
  });

  it('hashes PINs with random salt using SHA-256 and verifies matches accurately', async () => {
    const creds1 = await createPinCredentials('4821');
    const creds2 = await createPinCredentials('4821');

    expect(creds1.pinSalt).toHaveLength(32);
    expect(creds1.pinHash).toHaveLength(64);
    expect(creds1.pinHash).not.toBe('4821');
    expect(creds1.pinSalt).not.toBe(creds2.pinSalt);
    expect(creds1.pinHash).not.toBe(creds2.pinHash);

    expect(await verifyPinAgainstSettings('4821', creds1)).toBe(true);
    expect(await verifyPinAgainstSettings('9999', creds1)).toBe(false);
    expect(await verifyPinAgainstSettings('1234', { pinCode: '1234' })).toBe(true);
  });

  it('extracts inline receiptDataUrl and hashes legacy pinCode during migration', async () => {
    const seed = createSeedState();
    const sampleDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const legacyState = {
      ...seed,
      settings: {
        ...seed.settings,
        pinEnabled: true,
        pinCode: '5678',
      },
      transactions: [
        {
          ...seed.transactions[0],
          receiptName: 'costco.png',
          receiptDataUrl: sampleDataUrl,
        },
        ...seed.transactions.slice(1),
      ],
    };

    localStorage.setItem(LEGACY_LOCALSTORAGE_KEY, JSON.stringify(legacyState));

    const { cleanState, extractedReceipts, changed } = await sanitizeAndMigrateState(legacyState);
    expect(changed).toBe(true);
    expect(cleanState.settings.pinCode).toBeUndefined();
    expect(cleanState.settings.pinHash).toHaveLength(64);
    expect(cleanState.settings.pinSalt).toHaveLength(32);
    expect(cleanState.transactions[0].receiptDataUrl).toBeUndefined();
    expect(cleanState.transactions[0].receiptId).toBe(`rcpt-${seed.transactions[0].id}`);
    expect(extractedReceipts).toHaveLength(1);
    expect(extractedReceipts[0].dataUrl).toBe(sampleDataUrl);

    // Also test full repository load from legacy localStorage
    const loaded = await loadAppStateFromRepo();
    expect(loaded.state?.settings.pinHash).toBeDefined();
    expect(loaded.state?.settings.pinCode).toBeUndefined();
    const storedReceipt = await getReceiptRecord(`rcpt-${seed.transactions[0].id}`);
    expect(storedReceipt?.fileName).toBe('costco.png');
  });

  it('calculates data URL size and formats bytes cleanly', () => {
    const dataUrl = 'data:text/plain;base64,SGVsbG8='; // "Hello" = 5 bytes
    expect(estimateDataUrlBytes(dataUrl)).toBe(5);
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
  });
});

describe('Receipt Vault & Crypto PIN UI Flows', () => {
  beforeEach(() => {
    localStorage.clear();
    resetMemoryFallbackForTests();
    createGuestDemoSession(0);
  });

  it('sets a salted SHA-256 PIN in Settings, locks the app, and unlocks with the PIN', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Settings/i }));

    fireEvent.change(await screen.findByLabelText('New household PIN'), {
      target: { value: '2580' },
    });
    fireEvent.change(screen.getByLabelText('Confirm household PIN'), { target: { value: '2580' } });
    fireEvent.click(screen.getByRole('button', { name: /Enable PIN Lock/i }));

    await waitFor(() => {
      expect(screen.getByText('SHA-256 Active')).toBeInTheDocument();
    });

    // Lock from header
    fireEvent.click(screen.getByRole('button', { name: /Lock household ledger/i }));
    expect(screen.getByText('Enter household PIN to unlock')).toBeInTheDocument();

    // Try wrong PIN first
    fireEvent.change(screen.getByLabelText('Household PIN'), { target: { value: '1111' } });
    fireEvent.click(screen.getByRole('button', { name: /Unlock Ledger/i }));
    await waitFor(() => {
      expect(screen.getByText('Incorrect PIN. Please try again.')).toBeInTheDocument();
    });

    // Unlock with correct PIN
    fireEvent.change(screen.getByLabelText('Household PIN'), { target: { value: '2580' } });
    fireEvent.click(screen.getByRole('button', { name: /Unlock Ledger/i }));
    await waitFor(() => {
      expect(screen.getByText(/Household Settings, Security/i)).toBeInTheDocument();
    });
  });

  it('attaches a receipt in Receipt Vault, opens lightbox, and removes with Undo', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Receipt Vault/i }));
    expect(await screen.findByText(/Receipt Vault & Document Archive/i)).toBeInTheDocument();

    // Switch to Missing (>= $50) tab
    fireEvent.click(screen.getByRole('button', { name: /Missing \(≥ \$50\)/i }));
    expect(screen.getByText('Botanical Zoo & Picnic')).toBeInTheDocument();

    // Attach a mock file to Botanical Zoo & Picnic (first missing item by date)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = new File(['receipt-pdf-bytes'], 'zoo-receipt.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Switch back to With Receipts tab and verify it appears
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /With Receipts/i }));
      expect(screen.getByText('zoo-receipt.pdf')).toBeInTheDocument();
    });

    // Inspect in lightbox
    fireEvent.click(screen.getByRole('button', { name: /Inspect/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Receipt: Botanical Zoo & Picnic/i)).toBeInTheDocument();
    });

    // Remove receipt -> Undo toast appears -> Undo restores receipt
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove Receipt' }));
    await waitFor(() => {
      expect(screen.getByText(/Removed receipt from/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Undo/i }));
    await waitFor(() => {
      expect(screen.getByText('zoo-receipt.pdf')).toBeInTheDocument();
    });
  });
});
