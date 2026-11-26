export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'INR' | 'CAD' | 'AUD' | 'JPY';

export type AppLanguage = 'en' | 'gu';

export type ThemeMode = 'light' | 'dark' | 'system';

export type TransactionType = 'income' | 'expense' | 'transfer';

export type TransactionStatus = 'cleared' | 'pending';

export type BudgetBucket = 'needs' | 'wants' | 'savings';

export type PlanTier = 'free' | 'plus' | 'advisor';

export type AssetClass = 'equity' | 'mutual_fund' | 'fixed_deposit' | 'gold' | 'bond' | 'other';

export interface InvestmentHolding {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  accountId: string;
  units: number;
  avgCostPerUnit: number;
  currentPricePerUnit: number;
  currency: CurrencyCode;
  expectedAnnualReturnPct?: number;
  ownerId: string;
}

export interface SipPlan {
  id: string;
  name: string;
  holdingId?: string;
  accountId: string;
  targetAccountId?: string;
  memberId: string;
  monthlyAmount: number;
  expectedAnnualReturnPct: number;
  dayOfMonth: number;
  isActive: boolean;
  lastInvestedDate?: string;
}

export type MemberRole = 'admin' | 'partner' | 'dependent' | 'shared' | 'advisor';

export type AccountRole = 'admin' | 'partner' | 'dependent' | 'advisor';

export interface AuthUser {
  id: string;
  householdId?: string;
  householdName?: string;
  name: string;
  email: string;
  role: AccountRole;
  memberId: string;
  avatar: string;
  passwordHash?: string;
  passwordSalt?: string;
  isDemo?: boolean;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  userId: string;
  householdId?: string;
  householdName?: string;
  name: string;
  email: string;
  role: AccountRole;
  memberId: string;
  avatar: string;
  planTier?: PlanTier;
  planStatus?: 'active' | 'trialing' | 'past_due' | 'canceled';
  trialEndsAt?: string;
  planExpiresAt?: string;
  isDemo: boolean;
}

export type PublicLegalPage = 'privacy' | 'terms' | 'refund-policy' | 'contact';

export type InsuranceType = 'term' | 'health' | 'endowment' | 'vehicle';

export interface InsurancePolicy {
  id: string;
  name: string;
  insurer: string;
  type: InsuranceType;
  coverAmount: number;
  annualPremium: number;
  currency: CurrencyCode;
  insuredMemberId: string;
  nomineeName?: string;
  renewalDate: string; // YYYY-MM-DD
  isEmployerProvided?: boolean;
}

export interface EmergencyVaultMeta {
  willLocation: string;
  bankLockerInfo: string;
  advisorContact: string;
  nomineeNotes: string;
  updatedAt?: string;
}

export type AccountType = 'checking' | 'savings' | 'cash' | 'credit' | 'investment';

export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface FamilyMember {
  id: string;
  name: string;
  role: MemberRole;
  avatar: string;
  color: string;
  monthlyAllowance: number;
  monthlyIncomeTarget?: number;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  ownerId: string;
  initialBalance: number;
  creditLimit?: number;
  institution?: string;
  color: string;
  currency: CurrencyCode;
  isArchived?: boolean;
  nomineeName?: string;
  lastVerifiedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
  bucket?: BudgetBucket;
  budgetLimit?: number;
  rollover?: boolean;
}

export interface CategorySplit {
  categoryId: string;
  amount: number;
  note?: string;
}

export interface MemberSplit {
  memberId: string;
  amount: number;
  settled?: boolean;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: CurrencyCode;
  /** Equivalent amount converted into household baseCurrency */
  baseAmount: number;
  date: string; // YYYY-MM-DD
  merchant: string;
  categoryId: string;
  accountId: string;
  toAccountId?: string;
  memberId: string;
  categorySplits?: CategorySplit[];
  memberSplits?: MemberSplit[];
  tags: string[];
  note: string;
  status: TransactionStatus;
  receiptId?: string;
  receiptName?: string;
  receiptSizeBytes?: number;
  /** Legacy inline receipt data URL; migrated automatically into IndexedDB Receipt Vault */
  receiptDataUrl?: string;
  recurringId?: string;
  createdAt: string;
}

export interface ReceiptRecord {
  id: string;
  txId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  createdAt: string;
}

export interface RecurringRule {
  id: string;
  title: string;
  type: TransactionType;
  amount: number;
  currency: CurrencyCode;
  frequency: RecurrenceFrequency;
  nextDueDate: string; // YYYY-MM-DD
  categoryId: string;
  accountId: string;
  toAccountId?: string;
  memberId: string;
  autoPost: boolean;
  isActive: boolean;
  lastPostedDate?: string;
}

export type GoalCategory = 'emergency' | 'travel' | 'education' | 'home' | 'vehicle' | 'other';

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // YYYY-MM-DD
  category: GoalCategory;
  linkedAccountId?: string;
  ownerId: string;
  priority: 'high' | 'medium' | 'low';
  color: string;
  icon: string;
}

export interface DebtItem {
  id: string;
  name: string;
  lender: string;
  originalAmount: number;
  currentBalance: number;
  interestRateApr: number;
  minimumPayment: number;
  dueDay: number;
  ownerId: string;
  accountId?: string;
}

export type RuleMatchType = 'contains' | 'startsWith' | 'exact';

export interface MerchantRule {
  id: string;
  pattern: string;
  matchType: RuleMatchType;
  categoryId: string;
  memberId?: string;
  tags?: string[];
  isActive: boolean;
}

export interface CsvPreset {
  id: string;
  name: string;
  dateCol: number;
  merchantCol: number;
  amountCol: number;
  typeCol: number;
  categoryCol: number;
  noteCol: number;
}

export type ActivityEntityType =
  | 'transaction'
  | 'receipt'
  | 'budget'
  | 'bill'
  | 'goal'
  | 'debt'
  | 'family'
  | 'rule'
  | 'sync'
  | 'settings';

export interface ActivityEntry {
  id: string;
  memberId: string;
  memberName: string;
  memberAvatar: string;
  action: string;
  summary: string;
  entityType: ActivityEntityType;
  createdAt: string;
}

export interface AppSettings {
  householdName: string;
  baseCurrency: CurrencyCode;
  exchangeRates: Record<CurrencyCode, number>;
  language?: AppLanguage;
  theme: ThemeMode;
  privacyMode: boolean;
  pinEnabled: boolean;
  pinHash?: string;
  pinSalt?: string;
  /** Legacy plaintext PIN field kept optional solely for automatic one-time migration */
  pinCode?: string;
  autoLockMinutes: number;
  startOfMonthDay: number;
  csvPresets?: CsvPreset[];
  planTier?: PlanTier;
  trialEndsAt?: string;
  onboardingDismissed?: boolean;
  onboardingChecklistDismissed?: boolean;
  syncEnabled?: boolean;
  syncServerUrl?: string;
  syncKey?: string;
}

export interface AppState {
  version: number;
  settings: AppSettings;
  members: FamilyMember[];
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurring: RecurringRule[];
  goals: SavingsGoal[];
  debts: DebtItem[];
  rules: MerchantRule[];
  investments?: InvestmentHolding[];
  sips?: SipPlan[];
  policies?: InsurancePolicy[];
  emergencyInfo?: EmergencyVaultMeta;
  auditLog?: ActivityEntry[];
}

export type ActiveView =
  | 'dashboard'
  | 'transactions'
  | 'receipts'
  | 'budgets'
  | 'bills'
  | 'automation'
  | 'goals'
  | 'accounts'
  | 'safety'
  | 'calculators'
  | 'family'
  | 'reports'
  | 'pricing'
  | 'settings';
