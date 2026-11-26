import type {
  Account,
  AccountType,
  AppLanguage,
  AssetClass,
  BudgetBucket,
  Category,
  CurrencyCode,
  FamilyMember,
  GoalCategory,
  InsuranceType,
  MemberRole,
  RecurrenceFrequency,
  RuleMatchType,
  TransactionStatus,
  TransactionType,
} from '../types/finance';

const GU_MONTHS_SHORT = [
  'જાન્યુ',
  'ફેબ્રુ',
  'માર્ચ',
  'એપ્રિલ',
  'મે',
  'જૂન',
  'જુલાઈ',
  'ઓગસ્ટ',
  'સપ્ટે',
  'ઓક્ટો',
  'નવે',
  'ડિસે',
];

const GU_MONTHS_FULL = [
  'જાન્યુઆરી',
  'ફેબ્રુઆરી',
  'માર્ચ',
  'એપ્રિલ',
  'મે',
  'જૂન',
  'જુલાઈ',
  'ઓગસ્ટ',
  'સપ્ટેમ્બર',
  'ઓક્ટોબર',
  'નવેમ્બર',
  'ડિસેમ્બર',
];

/**
 * Formats a YYYY-MM key according to the active language.
 */
export function localizeMonthLabel(monthKey: string, language: AppLanguage = 'en', full = false): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return monthKey;
  if (language === 'gu') {
    const label = full ? GU_MONTHS_FULL[m - 1] : GU_MONTHS_SHORT[m - 1];
    return `${label} ${y}`;
  }
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en-US', { month: full ? 'long' : 'short', year: 'numeric' });
}

/**
 * Formats a YYYY-MM-DD date string to a compact day + month badge.
 */
export function localizeShortDay(dateStr: string, language: AppLanguage = 'en'): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  if (language === 'gu') {
    return `${d} ${GU_MONTHS_SHORT[m - 1] ?? ''}`.trim();
  }
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

const GU_CATEGORY_BY_NAME: Record<string, string> = {
  'Primary Salary': 'મુખ્ય પગાર',
  'Freelance & Bonus': 'ફ્રીલાન્સ અને બોનસ',
  'Dividends & Interest': 'ડિવિડન્ડ અને વ્યાજ',
  'Refunds & Cashback': 'રિફંડ અને કેશબેક',
  'Housing & Mortgage': 'ઘરભાડું અને હોમ લોન',
  'Groceries & Pantry': 'કરિયાણું અને રાશન',
  'Utilities & Internet': 'વીજળી અને ઇન્ટરનેટ',
  'Transport & Fuel': 'મુસાફરી અને ઇંધણ',
  'Health & Pharmacy': 'આરોગ્ય અને દવાઓ',
  'Kids & Education': 'બાળકો અને શિક્ષણ',
  'Dining & Coffee': 'બહારનું ભોજન અને કોફી',
  'Subscriptions & Media': 'સબ્સ્ક્રિપ્શન અને મીડિયા',
  'Shopping & Home': 'ખરીદી અને ઘરવપરાશ',
  'Family Outings': 'પરિવારિક પ્રવાસ',
  'Goal Contributions': 'બચત લક્ષ્ય ફાળો',
};

export function localizeCategoryName(
  category: Pick<Category, 'name'> | undefined | null,
  language: AppLanguage = 'en'
): string {
  if (!category) return '';
  if (language !== 'gu') return category.name;
  return GU_CATEGORY_BY_NAME[category.name] ?? category.name;
}

const GU_SEED_TEXT_MAP: Record<string, string> = {
  'The Carter Family': 'કાર્ટર પરિવાર',
  Household: 'સંયુક્ત પરિવાર',
  Alex: 'એલેક્સ',
  Maya: 'માયા',
  Leo: 'લિયો',
  'Joint Checking': 'સંયુક્ત ચેકિંગ ખાતું',
  'Family Emergency HYSA': 'પરિવાર કટોકટી બચત',
  'Sapphire Rewards Card': 'સેફાયર રિવોર્ડ્સ કાર્ડ',
  'Family Cash Wallet': 'પરિવાર રોકડ વૉલેટ',
  '529 & Index Brokerage': '529 અને ઇન્ડેક્સ બ્રોકરેજ',
  'Chase Bank': 'ચેઝ બેંક',
  'Ally Savings': 'એલી સેવિંગ્સ',
  Chase: 'ચેઝ',
  'Cash Envelope': 'રોકડ પરબિડીયું',
  Vanguard: 'વેનગાર્ડ',
  'Manual Account': 'મેન્યુઅલ ખાતું',
  '6-Month Emergency Runway': '6-મહિનાનું કટોકટી ભંડોળ',
  'Japan Summer Family Trip': 'જાપાન ઉનાળુ પરિવાર પ્રવાસ',
  'Leo College 529 Milestone': 'લિયો કોલેજ 529 લક્ષ્ય',
  'Family Hybrid SUV Loan': 'પરિવાર હાઇબ્રિડ SUV લોન',
  'Solar Roof Panel Financing': 'સોલર રૂફ પેનલ લોન',
  'Credit Union Auto': 'ક્રેડિટ યુનિયન ઓટો',
  'GreenHome Finance': 'ગ્રીનહોમ ફાઇનાન્સ',
  'Oakridge Mortgage': 'ઓકરિજ હોમ લોન',
  'City Water & Trash': 'શહેર પાણી અને સફાઈ',
  'Family Health Insurance Copay Plan': 'પરિવાર આરોગ્ય વીમો યોજના',
  'Leo Piano & Coding Club': 'લિયો પિયાનો અને કોડિંગ ક્લબ',
  'Northstar Tech Payroll': 'નોર્થસ્ટાર ટેક પગાર',
  'Studio Design Retainer': 'સ્ટુડિયો ડિઝાઇન આવક',
  'Costco Wholesale': 'કોસ્ટકો હોલસેલ',
  'Vanguard Total Stock Index ETF': 'વેનગાર્ડ ટોટલ સ્ટોક ઇન્ડેક્સ ETF',
  'College 529 Balanced Index Fund': 'કોલેજ 529 બેલેન્સ્ડ ઇન્ડેક્સ ફંડ',
  'Sovereign Gold & Reserve Bonds': 'સોવરિન ગોલ્ડ અને રિઝર્વ બોન્ડ્સ',
  'Index ETF Monthly SIP': 'ઇન્ડેક્સ ETF માસિક SIP',
  'Leo College 529 SIP': 'લિયો કોલેજ 529 SIP',
  'Pure Term Life Cover (Alex)': 'પ્યોર ટર્મ લાઇફ વીમો (એલેક્સ)',
  'Comprehensive Family Health Floater': 'સંપૂર્ણ પરિવાર આરોગ્ય વીમો',
};

export function localizeEntityText(text: string | undefined | null, language: AppLanguage = 'en'): string {
  if (!text) return '';
  if (language !== 'gu') return text;
  return GU_SEED_TEXT_MAP[text] ?? text;
}

export function localizeMemberName(
  member: Pick<FamilyMember, 'name'> | undefined | null,
  language: AppLanguage = 'en'
): string {
  return localizeEntityText(member?.name ?? '', language);
}

export function localizeAccountName(
  account: Pick<Account, 'name'> | undefined | null,
  language: AppLanguage = 'en'
): string {
  return localizeEntityText(account?.name ?? '', language);
}

const GU_ROLES: Record<MemberRole, string> = {
  admin: 'એડમિન',
  partner: 'ભાગીદાર',
  dependent: 'આશ્રિત',
  shared: 'સંયુક્ત',
  advisor: 'સલાહકાર',
};

export function localizeRole(role: MemberRole, language: AppLanguage = 'en'): string {
  if (language !== 'gu') {
    if (role === 'dependent') return 'Child / Dependent';
    if (role === 'shared') return 'Shared Bucket';
    if (role === 'partner') return 'Partner';
    if (role === 'advisor') return 'Financial Advisor';
    return 'Admin';
  }
  return GU_ROLES[role];
}

export function localizeRoleBadge(role: MemberRole, language: AppLanguage = 'en'): string {
  return language === 'gu' ? GU_ROLES[role] : role;
}

const ACCOUNT_TYPE_EN: Record<AccountType, string> = {
  checking: 'Checking / Bank',
  savings: 'High-Yield Savings',
  cash: 'Cash Wallet',
  credit: 'Credit Card',
  investment: 'Brokerage / 529',
};

const ACCOUNT_TYPE_GU: Record<AccountType, string> = {
  checking: 'ચેકિંગ / બેંક ખાતું',
  savings: 'ઉચ્ચ-વ્યાજ બચત',
  cash: 'રોકડ વૉલેટ',
  credit: 'ક્રેડિટ કાર્ડ',
  investment: 'બ્રોકરેજ / 529 રોકાણ',
};

export function localizeAccountType(type: AccountType, language: AppLanguage = 'en'): string {
  return language === 'gu' ? ACCOUNT_TYPE_GU[type] : ACCOUNT_TYPE_EN[type];
}

const FREQ_EN: Record<RecurrenceFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const FREQ_GU: Record<RecurrenceFrequency, string> = {
  weekly: 'સાપ્તાહિક',
  biweekly: 'દર પખવાડિયે',
  monthly: 'માસિક',
  quarterly: 'ત્રિમાસિક',
  yearly: 'વાર્ષિક',
};

export function localizeFrequency(freq: RecurrenceFrequency, language: AppLanguage = 'en'): string {
  return language === 'gu' ? FREQ_GU[freq] : FREQ_EN[freq];
}

const BUCKET_EN: Record<BudgetBucket, string> = {
  needs: 'Needs',
  wants: 'Wants',
  savings: 'Savings',
};

const BUCKET_GU: Record<BudgetBucket, string> = {
  needs: 'જરૂરિયાતો',
  wants: 'ઈચ્છાઓ',
  savings: 'બચત',
};

export function localizeBucket(bucket: BudgetBucket, language: AppLanguage = 'en'): string {
  return language === 'gu' ? BUCKET_GU[bucket] : BUCKET_EN[bucket];
}

const GOAL_CAT_EN: Record<GoalCategory, string> = {
  emergency: 'Emergency',
  travel: 'Travel',
  education: 'Education',
  home: 'Home',
  vehicle: 'Vehicle',
  other: 'Other',
};

const GOAL_CAT_GU: Record<GoalCategory, string> = {
  emergency: 'કટોકટી ભંડોળ',
  travel: 'પ્રવાસ',
  education: 'શિક્ષણ',
  home: 'ઘર',
  vehicle: 'વાહન',
  other: 'અન્ય',
};

export function localizeGoalCategory(cat: GoalCategory, language: AppLanguage = 'en'): string {
  return language === 'gu' ? GOAL_CAT_GU[cat] : GOAL_CAT_EN[cat];
}

const TX_TYPE_GU: Record<TransactionType, string> = {
  expense: 'ખર્ચ',
  income: 'આવક',
  transfer: 'ટ્રાન્સફર',
};

export function localizeTxType(type: TransactionType, language: AppLanguage = 'en'): string {
  if (language === 'gu') return TX_TYPE_GU[type];
  return type;
}

const TX_STATUS_GU: Record<TransactionStatus, string> = {
  cleared: 'ક્લિયર્ડ',
  pending: 'બાકી',
};

export function localizeTxStatus(status: TransactionStatus, language: AppLanguage = 'en'): string {
  if (language === 'gu') return TX_STATUS_GU[status];
  return status === 'cleared' ? 'Cleared' : 'Pending';
}

const MATCH_TYPE_EN: Record<RuleMatchType, string> = {
  contains: 'Contains',
  startsWith: 'Starts With',
  exact: 'Exact Match',
};

const MATCH_TYPE_GU: Record<RuleMatchType, string> = {
  contains: 'સમાવે છે',
  startsWith: 'શરૂ થાય છે',
  exact: 'ચોક્કસ મેચ',
};

export function localizeMatchType(matchType: RuleMatchType, language: AppLanguage = 'en'): string {
  return language === 'gu' ? MATCH_TYPE_GU[matchType] : MATCH_TYPE_EN[matchType];
}

const CURRENCY_GU: Record<CurrencyCode, string> = {
  USD: 'અમેરિકન ડૉલર',
  EUR: 'યુરો',
  GBP: 'બ્રિટિશ પાઉન્ડ',
  INR: 'ભારતીય રૂપિયો',
  CAD: 'કેનેડિયન ડૉલર',
  AUD: 'ઓસ્ટ્રેલિયન ડૉલર',
  JPY: 'જાપાનીઝ યેન',
};

export function localizeCurrencyName(
  code: CurrencyCode,
  fallbackEn: string,
  language: AppLanguage = 'en'
): string {
  return language === 'gu' ? CURRENCY_GU[code] ?? fallbackEn : fallbackEn;
}

const ASSET_CLASS_EN: Record<AssetClass, string> = {
  equity: 'Equity / ETF',
  mutual_fund: 'Mutual Fund',
  fixed_deposit: 'Fixed Deposit',
  gold: 'Gold / Sovereign',
  bond: 'Bonds / Debt',
  other: 'Other Asset',
};

const ASSET_CLASS_GU: Record<AssetClass, string> = {
  equity: 'ઇક્વિટી / ETF શેર',
  mutual_fund: 'મ્યુચ્યુઅલ ફંડ',
  fixed_deposit: 'ફિક્સ્ડ ડિપોઝિટ (FD)',
  gold: 'સોનું / ગોલ્ડ બોન્ડ',
  bond: 'બોન્ડ / સુરક્ષિત દેવું',
  other: 'અન્ય રોકાણ',
};

export function localizeAssetClass(
  assetClass: AssetClass,
  language: AppLanguage = 'en'
): string {
  return language === 'gu' ? ASSET_CLASS_GU[assetClass] : ASSET_CLASS_EN[assetClass];
}

const POLICY_TYPE_EN: Record<InsuranceType, string> = {
  term: 'Term Life',
  health: 'Health Floater',
  endowment: 'Endowment / LIC',
  vehicle: 'Vehicle / Asset',
};

const POLICY_TYPE_GU: Record<InsuranceType, string> = {
  term: 'ટર્મ લાઇફ વીમો',
  health: 'આરોગ્ય વીમો',
  endowment: 'એન્ડોમેન્ટ / LIC પૉલિસી',
  vehicle: 'વાહન / મિલકત વીમો',
};

export function localizePolicyType(
  type: InsuranceType,
  language: AppLanguage = 'en'
): string {
  return language === 'gu' ? POLICY_TYPE_GU[type] : POLICY_TYPE_EN[type];
}
