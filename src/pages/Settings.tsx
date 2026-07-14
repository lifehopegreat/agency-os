import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import Switch from '../components/Switch';
import { usePreferences } from '../state/PreferencesContext';
import { useProviders } from '../state/ProvidersContext';
import { playCue } from '../state/GenerationContext';
import { useI18n } from '../i18n/useI18n';
import type { Locale } from '../i18n/locales';

const SettingsPage = () => {
  const {
    openQueueOnSubmit,
    completionSound,
    compactDensity,
    reverseAiAssist,
    reverseApi,
    reverseApiConfigured,
    reverseProviderModelKey,
    defaultImageModelKey,
    defaultVideoModelKey,
    setOpenQueueOnSubmit,
    setCompletionSound,
    setCompactDensity,
    setReverseAiAssist,
    setReverseApi,
    setReverseProviderModelKey,
    setDefaultImageModelKey,
    setDefaultVideoModelKey,
  } = usePreferences();
  const { selectableModels } = useProviders();
  const { t, locale, setLocale, locales, localeLabels } = useI18n();
  const [reverseOpen, setReverseOpen] = useState(false);

  const reverseModels = useMemo(
    () => selectableModels.filter((model) => !model.kind || model.kind === 'vision'),
    [selectableModels],
  );
  const imageModels = useMemo(
    () => selectableModels.filter((model) => !model.kind || model.kind === 'image'),
    [selectableModels],
  );
  const videoModels = useMemo(
    () => selectableModels.filter((model) => !model.kind || model.kind === 'video'),
    [selectableModels],
  );
  const hasReverseProviderModel = reverseModels.some((model) => model.key === reverseProviderModelKey);
  const reverseSummary = !reverseAiAssist
    ? t('settings.reverse.summary.off')
    : hasReverseProviderModel
      ? t('settings.reverse.summary.provider')
      : reverseApiConfigured
      ? t('settings.reverse.summary.dedicated')
      : t('settings.reverse.summary.local');

  return (
    <div className="settings-page">
      <header className="page-header">
        <div className="page-header-text">
          <div className="page-kicker">{t('settings.kicker')}</div>
          <h1 className="page-title">{t('settings.title')}</h1>
          <p className="page-desc">{t('settings.desc')}</p>
        </div>
      </header>

      <div className="settings-list">
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t('settings.language')}</div>
            <div className="settings-row-desc">{t('settings.language.desc')}</div>
          </div>
          <div className="lang-segment" role="group" aria-label={t('settings.language')}>
            {locales.map((code) => (
              <button
                key={code}
                type="button"
                className={`lang-segment-btn ${locale === code ? 'active' : ''}`}
                onClick={() => setLocale(code as Locale)}
                aria-pressed={locale === code}
              >
                {localeLabels[code]}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t('settings.openQueue')}</div>
            <div className="settings-row-desc">{t('settings.openQueue.desc')}</div>
          </div>
          <Switch
            checked={openQueueOnSubmit}
            onChange={setOpenQueueOnSubmit}
            label={t('settings.openQueue')}
          />
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t('settings.sound')}</div>
            <div className="settings-row-desc">{t('settings.sound.desc')}</div>
          </div>
          <Switch
            checked={completionSound}
            onChange={(enabled) => {
              setCompletionSound(enabled);
              if (enabled) void playCue();
            }}
            label={t('settings.sound')}
          />
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t('settings.compact')}</div>
            <div className="settings-row-desc">{t('settings.compact.desc')}</div>
          </div>
          <Switch
            checked={compactDensity}
            onChange={setCompactDensity}
            label={t('settings.compact')}
          />
        </div>

        {/* Same list container — full width, aligned with rows above */}
        <div className={`settings-collapse-block ${reverseOpen ? 'is-open' : ''}`}>
          <button
            type="button"
            className="settings-collapse-trigger"
            onClick={() => setReverseOpen((v) => !v)}
            aria-expanded={reverseOpen}
            aria-controls="settings-reverse-panel"
          >
            <div className="settings-collapse-text">
              <div className="settings-collapse-title-row">
                <span className="settings-row-label">{t('settings.reverseAssist')}</span>
                <span className="badge mono">{t('settings.reverseApi.badge')}</span>
              </div>
              <div className="settings-row-desc settings-collapse-summary mono">
                {reverseSummary}
              </div>
            </div>
            <ChevronDown
              size={18}
              className={`settings-collapse-chevron ${reverseOpen ? 'is-open' : ''}`}
            />
          </button>

          {reverseOpen && (
            <div id="settings-reverse-panel" className="settings-collapse-body">
              <div className="settings-collapse-switch-row">
                <div>
                  <div className="settings-row-label">{t('settings.reverseAssist')}</div>
                  <div className="settings-row-desc">{t('settings.reverseAssist.desc')}</div>
                </div>
                <Switch
                  checked={reverseAiAssist}
                  onChange={setReverseAiAssist}
                  label={t('settings.reverseAssist')}
                />
              </div>

              <div className="settings-collapse-divider" />

              <div className="card-header settings-card-header-row">
                <span>{t('settings.reverseProvider')}</span>
              </div>
              <p className="form-field-hint" style={{ marginBottom: '0.65rem' }}>
                {t('settings.reverseProvider.desc')}
              </p>
              <div className="form-group">
                <label htmlFor="reverse-provider-model">{t('settings.reverseProvider.model')}</label>
                <select
                  id="reverse-provider-model"
                  className="mono"
                  value={reverseProviderModelKey}
                  onChange={(event) => setReverseProviderModelKey(event.target.value)}
                  disabled={!reverseAiAssist}
                >
                  <option value="">{t('settings.reverseProvider.empty')}</option>
                  {reverseModels.map((model) => (
                    <option key={model.key} value={model.key}>
                      {model.providerName} / {model.label}
                    </option>
                  ))}
                </select>
                <p className="form-field-hint">{t('settings.reverseProvider.hint')}</p>
              </div>

              <div className="card-header settings-card-header-row">
                <span>{t('settings.reverseApi')}</span>
              </div>
              <p className="form-field-hint" style={{ marginBottom: '0.65rem' }}>
                {t('settings.reverseApi.desc')}
              </p>
              <ol className="settings-priority-list mono">
                <li>{t('settings.reverseApi.priority')}</li>
              </ol>
              {!reverseAiAssist && (
                <p className="form-field-hint" style={{ marginBottom: '0.85rem' }}>
                  {t('settings.reverseApi.offHint')}
                </p>
              )}
              {reverseAiAssist && !hasReverseProviderModel && !reverseApiConfigured && (
                <p className="form-field-hint settings-warn" style={{ marginBottom: '0.85rem' }}>
                  {t('settings.reverseApi.fallbackHint')}
                </p>
              )}
              {reverseAiAssist && (hasReverseProviderModel || reverseApiConfigured) && (
                <p className="form-field-hint settings-ok" style={{ marginBottom: '0.85rem' }}>
                  {t('settings.reverseApi.configuredHint')}
                </p>
              )}
              <div className="form-group">
                <label htmlFor="rev-url">{t('settings.reverseApi.url')}</label>
                <input
                  id="rev-url"
                  type="url"
                  className="mono"
                  placeholder="https://api.example.com/v1"
                  value={reverseApi.baseUrl}
                  onChange={(e) => setReverseApi({ baseUrl: e.target.value })}
                  disabled={!reverseAiAssist}
                />
              </div>
              <div className="form-group">
                <label htmlFor="rev-key">{t('settings.reverseApi.key')}</label>
                <input
                  id="rev-key"
                  type="password"
                  className="mono"
                  placeholder="sk-…"
                  autoComplete="off"
                  value={reverseApi.apiKey}
                  onChange={(e) => setReverseApi({ apiKey: e.target.value })}
                  disabled={!reverseAiAssist}
                />
              </div>
              <div className="form-group form-group-last">
                <label htmlFor="rev-model">{t('settings.reverseApi.model')}</label>
                <input
                  id="rev-model"
                  type="text"
                  className="mono"
                  placeholder="gpt-4o-mini / internvl / …"
                  value={reverseApi.model}
                  onChange={(e) => setReverseApi({ model: e.target.value })}
                  disabled={!reverseAiAssist}
                />
                <p className="form-field-hint">{t('settings.reverseApi.modelHint')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card settings-panel settings-panel-full">
        <div className="card-header">{t('settings.workspace')}</div>
        {selectableModels.length === 0 ? (
          <div className="form-group form-group-last">
            <p className="form-field-hint">
              {t('settings.defaultModel.empty')}{' '}
              <Link to="/providers" className="text-link">
                {t('app.nav.providers')}
              </Link>
            </p>
          </div>
        ) : (
          <div className="form-grid form-grid-tight">
            <div className="form-group">
              <label htmlFor="default-image-model">{t('settings.defaultImageModel')}</label>
            <select
              id="default-image-model"
              className="mono"
              value={defaultImageModelKey}
              onChange={(event) => setDefaultImageModelKey(event.target.value)}
            >
              <option value="">{t('settings.defaultModel.auto')}</option>
              {imageModels.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.providerName} · {m.label}
                </option>
              ))}
            </select>
            </div>
            <div className="form-group form-group-last">
              <label htmlFor="default-video-model">{t('settings.defaultVideoModel')}</label>
              <select
                id="default-video-model"
                className="mono"
                value={defaultVideoModelKey}
                onChange={(event) => setDefaultVideoModelKey(event.target.value)}
              >
                <option value="">{t('settings.defaultModel.auto')}</option>
                {videoModels.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.providerName} 路 {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
