import { type Locale, translate } from './locales';

/** Module-level locale for non-React code (e.g. GenerationContext timers). */
let runtimeLocale: Locale = 'zh';

export function setRuntimeLocale(locale: Locale) {
  runtimeLocale = locale;
}

export function getRuntimeLocale(): Locale {
  return runtimeLocale;
}

export function tt(key: string, params?: Record<string, string | number>) {
  return translate(runtimeLocale, key, params);
}
