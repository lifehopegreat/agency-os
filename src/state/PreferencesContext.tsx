import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Locale } from '../i18n/locales';
import { setRuntimeLocale } from '../i18n/runtime';

/** Dedicated reverse-prompt (image→prompt) API endpoint config */
export type ReverseApiConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type Preferences = {
  openQueueOnSubmit: boolean;
  completionSound: boolean;
  compactDensity: boolean;
  locale: Locale;
  /** When true, reverse may use an explicitly selected vision model or dedicated API. */
  reverseAiAssist: boolean;
  reverseApi: ReverseApiConfig;
  /** Exact provider/model key selected for image-to-prompt assistance. */
  reverseProviderModelKey: string;
  /** Per-output defaults are intentionally separate: image and video models differ. */
  defaultImageModelKey: string;
  defaultVideoModelKey: string;
};

type PreferencesContextValue = Preferences & {
  setOpenQueueOnSubmit: (v: boolean) => void;
  setCompletionSound: (v: boolean) => void;
  setCompactDensity: (v: boolean) => void;
  setLocale: (v: Locale) => void;
  setReverseAiAssist: (v: boolean) => void;
  setReverseApi: (patch: Partial<ReverseApiConfig>) => void;
  setReverseProviderModelKey: (v: string) => void;
  setDefaultImageModelKey: (v: string) => void;
  setDefaultVideoModelKey: (v: string) => void;
  /** Reverse API has enough fields to attempt a dedicated call */
  reverseApiConfigured: boolean;
};

const STORAGE_KEY = 'agency_os_prefs_v1';

const emptyReverseApi: ReverseApiConfig = {
  baseUrl: '',
  apiKey: '',
  model: '',
};

const defaults: Preferences = {
  openQueueOnSubmit: false,
  completionSound: false,
  compactDensity: true,
  locale: 'zh',
  reverseAiAssist: false,
  reverseApi: emptyReverseApi,
  reverseProviderModelKey: '',
  defaultImageModelKey: '',
  defaultVideoModelKey: '',
};

function detectDefaultLocale(): Locale {
  try {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('zh')) return 'zh';
    return 'en';
  } catch {
    return 'zh';
  }
}

function loadPrefs(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults, locale: detectDefaultLocale() };
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    const locale: Locale =
      parsed.locale === 'en' ? 'en' : parsed.locale === 'zh' ? 'zh' : detectDefaultLocale();
    const reverseApi: ReverseApiConfig = {
      ...emptyReverseApi,
      ...(parsed.reverseApi && typeof parsed.reverseApi === 'object'
        ? {
            baseUrl:
              typeof parsed.reverseApi.baseUrl === 'string'
                ? parsed.reverseApi.baseUrl
                : '',
            apiKey:
              typeof parsed.reverseApi.apiKey === 'string' ? parsed.reverseApi.apiKey : '',
            model:
              typeof parsed.reverseApi.model === 'string' ? parsed.reverseApi.model : '',
          }
        : {}),
    };
    return {
      ...defaults,
      ...parsed,
      locale,
      reverseAiAssist: Boolean(parsed.reverseAiAssist),
      reverseApi,
      reverseProviderModelKey: typeof parsed.reverseProviderModelKey === 'string' ? parsed.reverseProviderModelKey : '',
      defaultImageModelKey: typeof parsed.defaultImageModelKey === 'string' ? parsed.defaultImageModelKey : '',
      defaultVideoModelKey: typeof parsed.defaultVideoModelKey === 'string' ? parsed.defaultVideoModelKey : '',
    };
  } catch {
    return { ...defaults, locale: detectDefaultLocale() };
  }
}

function isReverseConfigured(cfg: ReverseApiConfig): boolean {
  return Boolean(cfg.baseUrl.trim() && cfg.model.trim());
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(() =>
    typeof window === 'undefined' ? defaults : loadPrefs(),
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    document.documentElement.dataset.density = prefs.compactDensity ? 'compact' : 'comfortable';
    document.documentElement.lang = prefs.locale === 'zh' ? 'zh-CN' : 'en';
    setRuntimeLocale(prefs.locale);
  }, [prefs]);

  useEffect(() => {
    setRuntimeLocale(prefs.locale);
    document.documentElement.lang = prefs.locale === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.dataset.density = prefs.compactDensity ? 'compact' : 'comfortable';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setOpenQueueOnSubmit = useCallback((v: boolean) => {
    setPrefs((p) => ({ ...p, openQueueOnSubmit: v }));
  }, []);

  const setCompletionSound = useCallback((v: boolean) => {
    setPrefs((p) => ({ ...p, completionSound: v }));
  }, []);

  const setCompactDensity = useCallback((v: boolean) => {
    setPrefs((p) => ({ ...p, compactDensity: v }));
  }, []);

  const setLocale = useCallback((v: Locale) => {
    setPrefs((p) => ({ ...p, locale: v }));
  }, []);

  const setReverseAiAssist = useCallback((v: boolean) => {
    setPrefs((p) => ({ ...p, reverseAiAssist: v }));
  }, []);

  const setReverseApi = useCallback((patch: Partial<ReverseApiConfig>) => {
    setPrefs((p) => ({
      ...p,
      reverseApi: { ...p.reverseApi, ...patch },
    }));
  }, []);

  const setReverseProviderModelKey = useCallback((v: string) => {
    setPrefs((p) => ({ ...p, reverseProviderModelKey: v }));
  }, []);

  const setDefaultImageModelKey = useCallback((v: string) => {
    setPrefs((p) => ({ ...p, defaultImageModelKey: v }));
  }, []);

  const setDefaultVideoModelKey = useCallback((v: string) => {
    setPrefs((p) => ({ ...p, defaultVideoModelKey: v }));
  }, []);

  const reverseApiConfigured = isReverseConfigured(prefs.reverseApi);

  const value = useMemo(
    () => ({
      ...prefs,
      reverseApiConfigured,
      setOpenQueueOnSubmit,
      setCompletionSound,
      setCompactDensity,
      setLocale,
      setReverseAiAssist,
      setReverseApi,
      setReverseProviderModelKey,
      setDefaultImageModelKey,
      setDefaultVideoModelKey,
    }),
    [
      prefs,
      reverseApiConfigured,
      setOpenQueueOnSubmit,
      setCompletionSound,
      setCompactDensity,
      setLocale,
      setReverseAiAssist,
      setReverseApi,
      setReverseProviderModelKey,
      setDefaultImageModelKey,
      setDefaultVideoModelKey,
    ],
  );

  return (
    <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
