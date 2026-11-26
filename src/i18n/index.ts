import type { AppLanguage } from '../types/finance';
import { DICT_CORE, type BilingualEntry } from './dictCore';
import { DICT_RUNTIME } from './dictRuntime';
import { DICT_SAAS } from './dictSaas';
import { DICT_VIEWS } from './dictViews';

export * from './localize';

export const TRANSLATIONS = {
  ...DICT_CORE,
  ...DICT_VIEWS,
  ...DICT_RUNTIME,
  ...DICT_SAAS,
} as const satisfies Record<string, BilingualEntry>;

export type TranslationKey = keyof typeof TRANSLATIONS;

/**
 * Resolves a translation key for the given language with optional `{placeholder}` interpolation.
 */
export function translate(
  language: AppLanguage,
  key: TranslationKey,
  vars?: Record<string, string | number>
): string {
  const entry = TRANSLATIONS[key];
  let template = language === 'gu' ? entry.gu : entry.en;
  if (!vars) return template;
  for (const [k, v] of Object.entries(vars)) {
    template = template.split(`{${k}}`).join(String(v));
  }
  return template;
}
