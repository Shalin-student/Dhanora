import type {
  Account,
  AppLanguage,
  Category,
  CurrencyCode,
  FamilyMember,
  MerchantRule,
  Transaction,
  TransactionType,
} from '../types/finance';
import {
  localizeAccountName,
  localizeCategoryName,
  localizeEntityText,
  localizeMemberName,
  localizeTxStatus,
  localizeTxType,
} from '../i18n/localize';
import { matchMerchantRule } from './automation';
import { convertCurrency } from './currency';

function escapeCsvCell(val: string | number | undefined): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const GU_CSV_HEADERS = [
  'તારીખ',
  'પ્રકાર',
  'દુકાનદાર / વિગત',
  'શ્રેણી',
  'રકમ',
  'ચલણ',
  'મૂળ રકમ',
  'ખાતું',
  'જમા ખાતું',
  'સભ્ય',
  'સ્થિતિ',
  'ટૅગ્સ',
  'નોંધ',
];

const EN_CSV_HEADERS = [
  'Date',
  'Type',
  'Merchant',
  'Category',
  'Amount',
  'Currency',
  'BaseAmount',
  'Account',
  'ToAccount',
  'Member',
  'Status',
  'Tags',
  'Note',
];

export function exportTransactionsToCsv(
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[],
  members: FamilyMember[],
  language: AppLanguage = 'en'
): string {
  const catMap = new Map(categories.map((c) => [c.id, localizeCategoryName(c, language)]));
  const accMap = new Map(accounts.map((a) => [a.id, localizeAccountName(a, language)]));
  const memMap = new Map(members.map((m) => [m.id, localizeMemberName(m, language)]));

  const headers = language === 'gu' ? GU_CSV_HEADERS : EN_CSV_HEADERS;

  const rows = transactions.map((tx) =>
    [
      tx.date,
      language === 'gu' ? localizeTxType(tx.type, 'gu') : tx.type,
      localizeEntityText(tx.merchant, language),
      catMap.get(tx.categoryId) ?? tx.categoryId,
      tx.amount,
      tx.currency,
      tx.baseAmount,
      accMap.get(tx.accountId) ?? tx.accountId,
      tx.toAccountId ? accMap.get(tx.toAccountId) ?? tx.toAccountId : '',
      memMap.get(tx.memberId) ?? tx.memberId,
      language === 'gu' ? localizeTxStatus(tx.status, 'gu') : tx.status,
      tx.tags.join(';'),
      tx.note,
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

export function parseCsvText(rawText: string): string[][] {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  const text = rawText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (ch === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some((cell) => cell !== '')) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }
  }
  currentRow.push(currentField.trim());
  if (currentRow.some((cell) => cell !== '')) {
    lines.push(currentRow);
  }
  return lines;
}

export interface CsvColumnMapping {
  dateCol: number;
  merchantCol: number;
  amountCol: number;
  typeCol: number;
  categoryCol: number;
  noteCol: number;
}

export function buildTransactionFingerprint(
  date: string,
  amount: number,
  merchant: string
): string {
  const normMerchant = merchant.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${date}::${Math.abs(amount).toFixed(2)}::${normMerchant}`;
}

export function detectCsvDuplicates(
  candidates: Transaction[],
  existingTransactions: Transaction[]
): { unique: Transaction[]; duplicates: Transaction[] } {
  const existingSet = new Set(
    existingTransactions.map((tx) =>
      buildTransactionFingerprint(tx.date, tx.amount, tx.merchant)
    )
  );
  const seenInBatch = new Set<string>();
  const unique: Transaction[] = [];
  const duplicates: Transaction[] = [];

  for (const tx of candidates) {
    const fp = buildTransactionFingerprint(tx.date, tx.amount, tx.merchant);
    if (existingSet.has(fp) || seenInBatch.has(fp)) {
      duplicates.push(tx);
    } else {
      seenInBatch.add(fp);
      unique.push(tx);
    }
  }
  return { unique, duplicates };
}

export function mapCsvRowsToTransactions(
  rows: string[][],
  mapping: CsvColumnMapping,
  defaults: {
    accountId: string;
    memberId: string;
    baseCurrency: CurrencyCode;
    exchangeRates: Record<CurrencyCode, number>;
    categories: Category[];
    rules?: MerchantRule[];
  }
): Transaction[] {
  const result: Transaction[] = [];
  const catByName = new Map(defaults.categories.map((c) => [c.name.toLowerCase(), c]));
  const fallbackExp = defaults.categories.find((c) => c.type === 'expense')?.id ?? 'cat-shopping';
  const fallbackInc = defaults.categories.find((c) => c.type === 'income')?.id ?? 'cat-salary';

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rawDate = row[mapping.dateCol] || '';
    const rawAmount = parseFloat((row[mapping.amountCol] || '').replace(/[^0-9.-]/g, ''));
    if (!rawDate || Number.isNaN(rawAmount) || rawAmount === 0) continue;

    // Normalize date YYYY-MM-DD if MM/DD/YYYY or YYYY/MM/DD
    let normalizedDate = rawDate;
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      normalizedDate = rawDate;
    } else {
      const parsed = new Date(rawDate);
      if (!Number.isNaN(parsed.getTime())) {
        normalizedDate = parsed.toISOString().slice(0, 10);
      } else {
        continue;
      }
    }

    const rawType = (mapping.typeCol >= 0 ? row[mapping.typeCol] : '').toLowerCase();
    let type: TransactionType = rawAmount < 0 ? 'expense' : 'income';
    if (rawType.includes('exp') || rawType.includes('debit')) type = 'expense';
    else if (rawType.includes('inc') || rawType.includes('credit')) type = 'income';
    else if (rawType.includes('trans')) type = 'transfer';
    else if (mapping.typeCol < 0 && rawAmount > 0) type = 'expense'; // most bank CSV positive spends

    const absAmount = Math.abs(rawAmount);
    const merchant = (mapping.merchantCol >= 0 ? row[mapping.merchantCol] : '') || 'Imported Entry';
    const catText = (mapping.categoryCol >= 0 ? row[mapping.categoryCol] : '').toLowerCase();
    const matchedCat = catByName.get(catText);
    const matchedRule =
      type !== 'transfer' && defaults.rules ? matchMerchantRule(merchant, defaults.rules) : null;

    const categoryId =
      matchedCat?.id ?? matchedRule?.categoryId ?? (type === 'income' ? fallbackInc : fallbackExp);
    const memberId = matchedRule?.memberId ?? defaults.memberId;
    const tags = Array.from(new Set(['imported', ...(matchedRule?.tags ?? [])]));

    result.push({
      id: `tx-csv-${Date.now()}-${idx}`,
      type,
      amount: absAmount,
      currency: defaults.baseCurrency,
      baseAmount: convertCurrency(
        absAmount,
        defaults.baseCurrency,
        defaults.baseCurrency,
        defaults.exchangeRates
      ),
      date: normalizedDate,
      merchant,
      categoryId,
      accountId: defaults.accountId,
      memberId,
      tags,
      note: mapping.noteCol >= 0 ? row[mapping.noteCol] || '' : '',
      status: 'cleared',
      createdAt: new Date().toISOString(),
    });
  }

  return result;
}
