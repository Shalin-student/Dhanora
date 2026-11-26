import { useMemo } from 'react';
import { useFinance } from '../store/FinanceContext';
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
import {
  localizeAccountName,
  localizeAccountType,
  localizeAssetClass,
  localizeBucket,
  localizeCategoryName,
  localizeCurrencyName,
  localizeEntityText,
  localizeFrequency,
  localizeGoalCategory,
  localizeMatchType,
  localizeMemberName,
  localizeMonthLabel,
  localizePolicyType,
  localizeRole,
  localizeRoleBadge,
  localizeShortDay,
  localizeTxStatus,
  localizeTxType,
  translate,
  type TranslationKey,
} from './index';

export function useI18n() {
  const { state } = useFinance();
  const language: AppLanguage = state.settings.language ?? 'en';

  return useMemo(
    () => ({
      language,
      t: (key: TranslationKey, vars?: Record<string, string | number>) =>
        translate(language, key, vars),
      formatMonth: (monthKey: string, full = false) => localizeMonthLabel(monthKey, language, full),
      formatDay: (dateStr: string) => localizeShortDay(dateStr, language),
      catName: (category: Pick<Category, 'name'> | undefined | null) =>
        localizeCategoryName(category, language),
      memName: (member: Pick<FamilyMember, 'name'> | undefined | null) =>
        localizeMemberName(member, language),
      accName: (account: Pick<Account, 'name'> | undefined | null) =>
        localizeAccountName(account, language),
      entityText: (text: string | undefined | null) => localizeEntityText(text, language),
      roleLabel: (role: MemberRole) => localizeRole(role, language),
      roleBadge: (role: MemberRole) => localizeRoleBadge(role, language),
      accountTypeLabel: (type: AccountType) => localizeAccountType(type, language),
      freqLabel: (freq: RecurrenceFrequency) => localizeFrequency(freq, language),
      bucketLabel: (bucket: BudgetBucket) => localizeBucket(bucket, language),
      goalCatLabel: (cat: GoalCategory) => localizeGoalCategory(cat, language),
      txTypeLabel: (type: TransactionType) => localizeTxType(type, language),
      txStatusLabel: (status: TransactionStatus) => localizeTxStatus(status, language),
      matchTypeLabel: (matchType: RuleMatchType) => localizeMatchType(matchType, language),
      currencyName: (code: CurrencyCode, fallbackEn: string) =>
        localizeCurrencyName(code, fallbackEn, language),
      assetClassLabel: (assetClass: AssetClass) => localizeAssetClass(assetClass, language),
      policyTypeLabel: (type: InsuranceType) => localizePolicyType(type, language),
    }),
    [language]
  );
}
