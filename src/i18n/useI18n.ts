import { useCallback, useMemo } from 'react';
import { usePreferences } from '../state/PreferencesContext';
import { type Locale, localeLabels, translate } from './locales';

export function useI18n() {
  const { locale, setLocale } = usePreferences();

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(locale, key, params),
    [locale],
  );

  const statusLabel = useCallback(
    (status: string) => {
      const map: Record<string, string> = {
        idle: t('common.idle'),
        queued: t('common.queued'),
        running: t('common.running'),
        failed: t('common.failed'),
        success: t('common.success'),
        completed: t('common.completed'),
        connected: t('common.connected'),
        disconnected: t('common.disconnected'),
      };
      return map[status] ?? status;
    },
    [t],
  );

  return useMemo(
    () => ({
      locale,
      setLocale,
      t,
      statusLabel,
      localeLabels,
      locales: ['zh', 'en'] as Locale[],
    }),
    [locale, setLocale, t, statusLabel],
  );
}
