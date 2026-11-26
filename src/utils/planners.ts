import type { Account, AppLanguage, InsurancePolicy, SavingsGoal, Transaction } from '../types/finance';
import { convertCurrency } from './currency';

/**
 * Parses Indian shorthand monetary strings like "25L", "1.5Cr", "50k", "₹2,50,000"
 * into numeric amounts. Returns NaN if invalid.
 */
export function parseAmountShorthand(raw: string): number {
  const cleaned = raw.trim().replace(/[₹$,\s]/g, '').toLowerCase();
  if (!cleaned) return Number.NaN;
  const match = /^(-?\d+(?:\.\d+)?)(cr|crore|l|lac|lakh|k)?$/.exec(cleaned);
  if (!match) return Number.NaN;
  const num = parseFloat(match[1]);
  const unit = match[2];
  if (!Number.isFinite(num)) return Number.NaN;
  if (unit === 'cr' || unit === 'crore') return Number((num * 10000000).toFixed(2));
  if (unit === 'l' || unit === 'lac' || unit === 'lakh') return Number((num * 100000).toFixed(2));
  if (unit === 'k') return Number((num * 1000).toFixed(2));
  return num;
}

export function formatIndianScaleHint(amount: number, language: AppLanguage = 'en'): string {
  if (!Number.isFinite(amount) || amount <= 0) return '';
  const abs = Math.abs(amount);
  if (abs >= 10000000) {
    const v = (abs / 10000000).toFixed(2);
    return language === 'gu' ? `${v} કરોડ` : `${v} Crore`;
  }
  if (abs >= 100000) {
    const v = (abs / 100000).toFixed(2);
    return language === 'gu' ? `${v} લાખ` : `${v} Lakh`;
  }
  if (abs >= 1000) {
    const v = (abs / 1000).toFixed(1);
    return language === 'gu' ? `${v} હજાર` : `${v} Thousand`;
  }
  return '';
}

export interface TaxRegimeInput {
  annualGrossIncome: number;
  deduction80C: number; // max 150,000
  deduction80D: number; // health insurance up to 100,000
  hraExemption: number;
  homeLoanInterest24B: number; // up to 200,000
  nps80CCD1B: number; // up to 50,000
  isSalaried?: boolean;
}

export interface TaxRegimeComparison {
  newRegimeTaxableIncome: number;
  newRegimeTax: number; // incl. 4% cess
  oldRegimeTaxableIncome: number;
  oldRegimeTax: number; // incl. 4% cess
  recommended: 'new' | 'old' | 'equal';
  savings: number;
  effectiveNewRatePct: number;
  effectiveOldRatePct: number;
}

function applySlabs(income: number, slabs: Array<[number, number]>): number {
  let remaining = Math.max(0, income);
  let prevCap = 0;
  let tax = 0;
  for (const [cap, rate] of slabs) {
    if (remaining <= prevCap) break;
    const taxableSlice = Math.min(remaining, cap) - prevCap;
    if (taxableSlice > 0) {
      tax += taxableSlice * rate;
    }
    prevCap = cap;
  }
  return tax;
}

/**
 * Compares Indian FY 2026-27 New Tax Regime (Sec 87A rebate up to ₹12L taxable)
 * vs Old Tax Regime (80C, 80D, HRA, 24b, 80CCD(1B) deductions + Sec 87A up to ₹5L).
 */
export function compareIndianTaxRegimes(input: TaxRegimeInput): TaxRegimeComparison {
  const gross = Math.max(0, input.annualGrossIncome || 0);
  const salaried = input.isSalaried !== false;

  // New Regime: ₹75,000 standard deduction for salaried, FY 2026-27 slabs
  const newStdDed = salaried ? Math.min(gross, 75000) : 0;
  const newTaxable = Math.max(0, gross - newStdDed);
  let newBaseTax = applySlabs(newTaxable, [
    [400000, 0],
    [800000, 0.05],
    [1200000, 0.1],
    [1600000, 0.15],
    [2000000, 0.2],
    [2400000, 0.25],
    [Infinity, 0.3],
  ]);
  if (newTaxable <= 1200000) {
    newBaseTax = 0; // Section 87A rebate
  } else if (salaried && newTaxable > 1200000 && newTaxable < 1275000) {
    // Marginal relief cap above ₹12L threshold
    newBaseTax = Math.min(newBaseTax, newTaxable - 1200000);
  }
  const newRegimeTax = Math.round(newBaseTax * 1.04);

  // Old Regime: ₹50,000 std ded + capped statutory deductions
  const oldStdDed = salaried ? Math.min(gross, 50000) : 0;
  const cappedDeductions =
    oldStdDed +
    Math.min(150000, Math.max(0, input.deduction80C || 0)) +
    Math.min(100000, Math.max(0, input.deduction80D || 0)) +
    Math.max(0, input.hraExemption || 0) +
    Math.min(200000, Math.max(0, input.homeLoanInterest24B || 0)) +
    Math.min(50000, Math.max(0, input.nps80CCD1B || 0));

  const oldTaxable = Math.max(0, gross - cappedDeductions);
  let oldBaseTax = applySlabs(oldTaxable, [
    [250000, 0],
    [500000, 0.05],
    [1000000, 0.2],
    [Infinity, 0.3],
  ]);
  if (oldTaxable <= 500000) {
    oldBaseTax = 0; // Section 87A old regime rebate
  }
  const oldRegimeTax = Math.round(oldBaseTax * 1.04);

  const diff = oldRegimeTax - newRegimeTax;
  const recommended: 'new' | 'old' | 'equal' =
    Math.abs(diff) < 100 ? 'equal' : diff > 0 ? 'new' : 'old';

  return {
    newRegimeTaxableIncome: Math.round(newTaxable),
    newRegimeTax,
    oldRegimeTaxableIncome: Math.round(oldTaxable),
    oldRegimeTax,
    recommended,
    savings: Math.abs(diff),
    effectiveNewRatePct: gross > 0 ? Number(((newRegimeTax / gross) * 100).toFixed(1)) : 0,
    effectiveOldRatePct: gross > 0 ? Number(((oldRegimeTax / gross) * 100).toFixed(1)) : 0,
  };
}

export interface FireSimulationInput {
  currentAge: number;
  retireAge: number;
  lifeExpectancy: number;
  currentCorpus: number;
  monthlyInvestment: number;
  monthlyRetirementExpenseToday: number;
  inflationPct: number;
  preRetireReturnPct: number;
  postRetireReturnPct: number;
  postRetireTaxPct: number;
}

export interface FireYearRow {
  age: number;
  phase: 'accumulate' | 'retire';
  startCorpus: number;
  annualCashflow: number; // +contrib or -withdrawal
  netReturnEarned: number;
  endCorpus: number;
}

export interface FireSimulationResult {
  corpusAtRetirement: number;
  requiredFireCorpus: number;
  isViableToLifeExpectancy: boolean;
  runsOutAge: number | null;
  surplusAtRetirement: number;
  rows: FireYearRow[];
}

/**
 * Simulates FIRE accumulation until `retireAge` followed by inflation-indexed
 * withdrawals with post-retirement tax drag up to `lifeExpectancy`.
 */
export function simulateFirePlan(input: FireSimulationInput): FireSimulationResult {
  const currentAge = Math.max(18, Math.min(75, Math.round(input.currentAge)));
  const retireAge = Math.max(currentAge + 1, Math.min(80, Math.round(input.retireAge)));
  const lifeExpectancy = Math.max(retireAge + 5, Math.min(100, Math.round(input.lifeExpectancy)));

  const inflRate = Math.max(0, input.inflationPct) / 100;
  const preRetRate = Math.max(0, input.preRetireReturnPct) / 100;
  const effectivePostRate =
    (Math.max(0, input.postRetireReturnPct) / 100) * (1 - Math.max(0, Math.min(45, input.postRetireTaxPct)) / 100);

  let corpus = Math.max(0, input.currentCorpus);
  const annualSaving = Math.max(0, input.monthlyInvestment * 12);
  let annualExpense = Math.max(0, input.monthlyRetirementExpenseToday * 12);

  const yearsToRetire = retireAge - currentAge;
  const expenseAtRetirement = annualExpense * Math.pow(1 + inflRate, yearsToRetire);
  // Required corpus uses 25x (4% SWR) adjusted for post-retirement real drawdown window
  const requiredFireCorpus = Math.round(expenseAtRetirement * 25);

  const rows: FireYearRow[] = [];
  let corpusAtRetirement = corpus;
  let runsOutAge: number | null = null;

  for (let age = currentAge; age <= lifeExpectancy; age++) {
    const phase: 'accumulate' | 'retire' = age < retireAge ? 'accumulate' : 'retire';
    const startCorpus = Number(corpus.toFixed(0));

    if (phase === 'accumulate') {
      const cashflow = annualSaving;
      const returnEarned = (corpus + cashflow * 0.5) * preRetRate;
      corpus = corpus + cashflow + returnEarned;
      rows.push({
        age,
        phase,
        startCorpus,
        annualCashflow: Math.round(cashflow),
        netReturnEarned: Math.round(returnEarned),
        endCorpus: Math.round(corpus),
      });
      if (age === retireAge - 1) {
        corpusAtRetirement = Math.round(corpus);
      }
    } else {
      const withdrawal = annualExpense;
      const netCorpusAfterDraw = Math.max(0, corpus - withdrawal);
      const returnEarned = netCorpusAfterDraw * effectivePostRate;
      corpus = Math.max(0, netCorpusAfterDraw + returnEarned);
      if (corpus <= 0 && runsOutAge === null) {
        runsOutAge = age;
      }
      rows.push({
        age,
        phase,
        startCorpus,
        annualCashflow: -Math.round(withdrawal),
        netReturnEarned: Math.round(returnEarned),
        endCorpus: Math.round(corpus),
      });
    }

    annualExpense *= 1 + inflRate;
  }

  return {
    corpusAtRetirement,
    requiredFireCorpus,
    isViableToLifeExpectancy: runsOutAge === null,
    runsOutAge,
    surplusAtRetirement: corpusAtRetirement - requiredFireCorpus,
    rows,
  };
}

export interface RentVsBuyInput {
  homePrice: number;
  downPaymentPct: number;
  loanRatePct: number;
  loanYears: number;
  monthlyRent: number;
  rentGrowthPct: number;
  homeAppreciationPct: number;
  investmentReturnPct: number;
  horizonYears: number;
}

export interface RentVsBuyResult {
  monthlyEmi: number;
  buyNetWealth: number;
  rentNetWealth: number;
  winner: 'buy' | 'rent';
  difference: number;
}

export function compareRentVsBuy(input: RentVsBuyInput): RentVsBuyResult {
  const price = Math.max(100000, input.homePrice);
  const downPct = Math.max(0.05, Math.min(0.95, input.downPaymentPct / 100));
  const downPayment = price * downPct;
  const principal = price - downPayment;
  const r = Math.max(0.0001, input.loanRatePct / 100 / 12);
  const n = Math.max(12, Math.round(input.loanYears * 12));
  const emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

  const horizon = Math.max(1, Math.min(30, Math.round(input.horizonYears)));
  let remainingLoan = principal;
  let rentPortfolio = downPayment + price * 0.06; // includes ~6% stamp duty saved by renting
  let currentMonthlyRent = Math.max(0, input.monthlyRent);
  const annualMaint = price * 0.01;
  const monthlyInvRate = input.investmentReturnPct / 100 / 12;

  for (let yr = 1; yr <= horizon; yr++) {
    for (let m = 0; m < 12; m++) {
      if (yr <= input.loanYears && remainingLoan > 0) {
        const interest = remainingLoan * r;
        const principalPaid = Math.min(remainingLoan, emi - interest);
        remainingLoan -= principalPaid;
      }
      const buyOutflow = (yr <= input.loanYears ? emi : 0) + annualMaint / 12;
      const monthlySurplusForRenter = buyOutflow - currentMonthlyRent;
      rentPortfolio = rentPortfolio * (1 + monthlyInvRate) + monthlySurplusForRenter;
    }
    currentMonthlyRent *= 1 + input.rentGrowthPct / 100;
  }

  const futureHomeValue = price * Math.pow(1 + input.homeAppreciationPct / 100, horizon);
  const buyNetWealth = Math.round(futureHomeValue - Math.max(0, remainingLoan));
  const rentNetWealth = Math.round(Math.max(0, rentPortfolio));

  return {
    monthlyEmi: Math.round(emi),
    buyNetWealth,
    rentNetWealth,
    winner: buyNetWealth >= rentNetWealth ? 'buy' : 'rent',
    difference: Math.abs(buyNetWealth - rentNetWealth),
  };
}

export interface PrepayVsInvestInput {
  outstandingLoan: number;
  loanAprPct: number;
  remainingMonths: number;
  extraMonthlySurplus: number;
  expectedInvestReturnPct: number;
  investTaxDragPct: number;
}

export interface PrepayVsInvestResult {
  baseTotalInterest: number;
  prepayTotalInterest: number;
  interestSaved: number;
  monthsSaved: number;
  postTaxInvestGain: number;
  recommended: 'prepay' | 'invest';
  netAdvantage: number;
}

export function comparePrepayVsInvest(input: PrepayVsInvestInput): PrepayVsInvestResult {
  const principal = Math.max(1000, input.outstandingLoan);
  const monthlyRate = Math.max(0.0001, input.loanAprPct / 100 / 12);
  const months = Math.max(1, Math.min(360, Math.round(input.remainingMonths)));
  const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);

  // Baseline interest
  let bBal = principal;
  let baseInterest = 0;
  for (let m = 0; m < months && bBal > 0; m++) {
    const intr = bBal * monthlyRate;
    baseInterest += intr;
    bBal -= Math.min(bBal, emi - intr);
  }

  // Prepay trajectory
  let pBal = principal;
  let prepayInterest = 0;
  let pMonths = 0;
  const extra = Math.max(0, input.extraMonthlySurplus);
  while (pBal > 0.01 && pMonths < months) {
    pMonths++;
    const intr = pBal * monthlyRate;
    prepayInterest += intr;
    const pay = Math.min(pBal + intr, emi + extra);
    pBal = Math.max(0, pBal + intr - pay);
  }

  const interestSaved = Math.max(0, Math.round(baseInterest - prepayInterest));
  const monthsSaved = Math.max(0, months - pMonths);

  // Investing same surplus for `months`
  const invRateMonthly = Math.max(0, input.expectedInvestReturnPct) / 100 / 12;
  let investCorpus = 0;
  for (let m = 0; m < months; m++) {
    investCorpus = (investCorpus + extra) * (1 + invRateMonthly);
  }
  const grossGain = Math.max(0, investCorpus - extra * months);
  const postTaxInvestGain = Math.round(
    grossGain * (1 - Math.max(0, Math.min(45, input.investTaxDragPct)) / 100)
  );

  return {
    baseTotalInterest: Math.round(baseInterest),
    prepayTotalInterest: Math.round(prepayInterest),
    interestSaved,
    monthsSaved,
    postTaxInvestGain,
    recommended: postTaxInvestGain >= interestSaved ? 'invest' : 'prepay',
    netAdvantage: Math.abs(postTaxInvestGain - interestSaved),
  };
}

export interface InsuranceAdequacySummary {
  recommendedTermCover: number;
  currentTermCover: number;
  termGap: number;
  currentHealthCover: number;
  missingNomineeAccounts: Account[];
  missingNomineePolicies: InsurancePolicy[];
}

export function computeInsuranceAdequacy(options: {
  accounts: Account[];
  policies: InsurancePolicy[];
  goals: SavingsGoal[];
  totalDebtBalance: number;
  annualEssentialExpenses: number;
  supportYears?: number;
  baseCurrency: Account['currency'];
  exchangeRates: Record<Account['currency'], number>;
  transactions: Transaction[];
}): InsuranceAdequacySummary {
  const years = Math.max(5, Math.min(30, options.supportYears ?? 15));
  const essentialGoalsNeeded = options.goals.reduce(
    (sum, g) => sum + Math.max(0, g.targetAmount - g.currentAmount),
    0
  );

  // Liquid savings help offset term need (excluding credit cards & archived accounts)
  let liquidSavings = 0;
  for (const acc of options.accounts) {
    if (acc.isArchived || acc.type === 'credit') continue;
    let bal = acc.initialBalance;
    for (const tx of options.transactions) {
      if (tx.accountId === acc.id) {
        if (tx.type === 'income') bal += tx.amount;
        else bal -= tx.amount;
      }
      if (tx.type === 'transfer' && tx.toAccountId === acc.id) bal += tx.amount;
    }
    if (bal > 0) {
      liquidSavings += convertCurrency(bal, acc.currency, options.baseCurrency, options.exchangeRates);
    }
  }

  const grossNeed =
    Math.max(0, options.totalDebtBalance) +
    Math.max(0, options.annualEssentialExpenses) * years +
    essentialGoalsNeeded;
  const recommendedTermCover = Math.max(0, Math.round(grossNeed - liquidSavings));

  let currentTermCover = 0;
  let currentHealthCover = 0;
  for (const p of options.policies) {
    const amt = convertCurrency(p.coverAmount, p.currency, options.baseCurrency, options.exchangeRates);
    if (p.type === 'term' || p.type === 'endowment') currentTermCover += amt;
    if (p.type === 'health') currentHealthCover += amt;
  }

  const missingNomineeAccounts = options.accounts.filter(
    (a) => !a.isArchived && a.type !== 'credit' && a.type !== 'cash' && !a.nomineeName?.trim()
  );
  const missingNomineePolicies = options.policies.filter(
    (p) => p.type !== 'vehicle' && !p.nomineeName?.trim()
  );

  return {
    recommendedTermCover: Math.round(recommendedTermCover),
    currentTermCover: Math.round(currentTermCover),
    termGap: Math.max(0, Math.round(recommendedTermCover - currentTermCover)),
    currentHealthCover: Math.round(currentHealthCover),
    missingNomineeAccounts,
    missingNomineePolicies,
  };
}

/**
 * Checks free text for accidentally pasted credentials/passwords/PINs/OTPs before storing
 * inside the Emergency Pack.
 */
export function containsSensitiveCredentialHint(text: string): boolean {
  return /\b(password|passcode|pin|otp|cvv|mpin|tpin|secret key)\s*[:=]/i.test(text);
}
