import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ScanSearch,
  Upload,
  Copy,
  ArrowRight,
  Loader2,
  Image as ImageIcon,
  Sparkles,
  Settings2,
  LayoutGrid,
} from 'lucide-react';
import { useI18n } from '../i18n/useI18n';
import { usePreferences } from '../state/PreferencesContext';
import { useProviders } from '../state/ProvidersContext';
import { useGeneration } from '../state/GenerationContext';
import {
  reverseImageToPrompt,
  type ReverseMode,
  type ReverseResult,
} from '../lib/reversePrompt';
import type { CreateLocationState } from '../lib/recipe';

const RESULT_STORAGE_KEY = 'agency_os_reverse_result_v1';

function loadSavedResult(): ReverseResult | null {
  try {
    const value = JSON.parse(localStorage.getItem(RESULT_STORAGE_KEY) ?? 'null') as Partial<ReverseResult> | null;
    if (!value || typeof value.prompt !== 'string' || !value.prompt.trim()) return null;
    return {
      prompt: value.prompt,
      mode: value.mode === 'reverse_api' || value.mode === 'provider_model' ? value.mode : 'local',
      sourceLabel: typeof value.sourceLabel === 'string' ? value.sourceLabel : '',
      tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      warnings: Array.isArray(value.warnings) ? value.warnings.filter((warning): warning is string => typeof warning === 'string') : [],
    };
  } catch {
    return null;
  }
}

const ReversePage = () => {
  const { t, locale } = useI18n();
  const {
    reverseAiAssist,
    reverseApi,
    reverseApiConfigured,
    reverseProviderModelKey,
  } = usePreferences();
  const { providers } = useProviders();
  const { pushToast } = useGeneration();
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReverseResult | null>(loadSavedResult);
  const hasReverseProviderModel = providers.some((provider) =>
    provider.status === 'connected' && provider.models.some((model) =>
      `${provider.id}::${model.id}` === reverseProviderModelKey && model.kind !== 'image' && model.kind !== 'video'),
  );
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      if (result) localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(result));
      else localStorage.removeItem(RESULT_STORAGE_KEY);
    } catch {
      // ponytail: retain the current-page result when browser storage is unavailable.
    }
  }, [result]);

  const assignFile = (f: File | undefined | null) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      pushToast({ tone: 'error', title: t('reverse.err.type') });
      return;
    }
    setFile(f);
    setResult(null);
    const url = URL.createObjectURL(f);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  };

  const modeBadge = (mode: ReverseMode) => {
    if (mode === 'local') return t('reverse.mode.local');
    if (mode === 'reverse_api') return t('reverse.mode.reverseApi');
    return t('reverse.mode.provider');
  };

  const runReverse = useCallback(async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const out = await reverseImageToPrompt({
        file,
        hint,
        locale,
        reverseAiAssist,
        reverseApi,
        reverseApiConfigured,
        providers,
        reverseProviderModelKey,
      });
      setResult(out);
      pushToast({
        tone: 'success',
        title: t('reverse.toast.done'),
        body: modeBadge(out.mode),
      });
    } catch (e) {
      pushToast({
        tone: 'error',
        title: t('reverse.toast.fail'),
        body: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }, [
    file,
    busy,
    hint,
    locale,
    reverseAiAssist,
    reverseApi,
    reverseApiConfigured,
    reverseProviderModelKey,
    providers,
    pushToast,
    t,
  ]);

  const copyPrompt = async () => {
    if (!result?.prompt) return;
    try {
      await navigator.clipboard.writeText(result.prompt);
      pushToast({ tone: 'info', title: t('reverse.toast.copied') });
    } catch {
      pushToast({ tone: 'error', title: t('reverse.toast.copyFail') });
    }
  };

  const sendToCreate = () => {
    if (!result?.prompt) return;
    const state: CreateLocationState = {
      reuse: {
        prompt: result.prompt,
        type: 'image',
        model: result.sourceLabel,
        ratio: '1:1',
      },
      reuseFrom: t('reverse.sendFrom'),
    };
    navigate('/', { state });
  };

  const sendToCanvas = () => {
    if (!result?.prompt) return;
    navigate('/canvas', { state: { addPrompt: result.prompt } });
  };

  const assistHint = !reverseAiAssist
    ? t('reverse.status.local')
    : hasReverseProviderModel
      ? t('reverse.status.provider')
      : reverseApiConfigured
      ? t('reverse.status.reverseApi')
      : t('reverse.status.local');

  return (
    <div className="reverse-page">
      <header className="page-header">
        <div className="page-header-text">
          <div className="page-kicker">{t('reverse.kicker')}</div>
          <h1 className="page-title">{t('reverse.title')}</h1>
          <p className="page-desc">{t('reverse.desc')}</p>
        </div>
        <Link to="/settings" className="btn btn-secondary btn-sm">
          <Settings2 size={14} /> {t('reverse.openSettings')}
        </Link>
      </header>

      <div className="reverse-status card">
        <Sparkles size={16} />
        <div className="reverse-status-text">
          <strong>{t('reverse.assist')}</strong>
          <span>{assistHint}</span>
        </div>
        <span className={`status-pill ${reverseAiAssist ? 'running' : 'idle'}`}>
          {reverseAiAssist ? t('reverse.assist.on') : t('reverse.assist.off')}
        </span>
      </div>

      <div className="reverse-priority card">
        <div className="card-header" style={{ marginBottom: '0.5rem' }}>
          {t('reverse.priority.title')}
        </div>
        <ol className="reverse-priority-steps mono">
          <li className={!reverseAiAssist ? 'is-active' : ''}>{t('reverse.priority.1')}</li>
          <li
            className={
              reverseAiAssist && hasReverseProviderModel ? 'is-active' : ''
            }
          >
            {t('reverse.route.provider')}
          </li>
          <li
            className={
              reverseAiAssist && !hasReverseProviderModel && reverseApiConfigured ? 'is-active' : ''
            }
          >
            {t('reverse.route.dedicated')}
          </li>
          <li>{t('reverse.priority.4')}</li>
        </ol>
      </div>

      <div className="reverse-layout">
        <div className="card reverse-upload-card">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => assignFile(e.target.files?.[0])}
          />
          <button
            type="button"
            className={`upload-zone reverse-drop ${dragging ? 'is-dragging' : ''} ${preview ? 'has-file' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              assignFile(e.dataTransfer.files?.[0]);
            }}
          >
            {preview ? (
              <img src={preview} alt="" className="reverse-preview-img" />
            ) : (
              <>
                <Upload size={22} strokeWidth={1.5} />
                <span className="upload-zone-title">{t('reverse.drop')}</span>
                <span className="upload-zone-sub">{t('reverse.drop.hint')}</span>
              </>
            )}
          </button>

          {file && (
            <div className="reverse-file-meta mono">
              <ImageIcon size={12} /> {file.name} · {(file.size / 1024).toFixed(1)} KB
            </div>
          )}

          <div className="form-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
            <label htmlFor="reverse-hint">{t('reverse.hint')}</label>
            <textarea
              id="reverse-hint"
              rows={3}
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder={t('reverse.hint.ph')}
            />
            <p className="form-field-hint">{t('reverse.hint.help')}</p>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-block"
            style={{ marginTop: '1rem' }}
            disabled={!file || busy}
            onClick={runReverse}
          >
            {busy ? (
              <>
                <Loader2 size={16} className="spin" /> {t('reverse.running')}
              </>
            ) : (
              <>
                <ScanSearch size={16} /> {t('reverse.run')}
              </>
            )}
          </button>
        </div>

        <div className="card reverse-result-card">
          <div className="card-header">{t('reverse.result')}</div>
          {!result ? (
            <div className="reverse-result-empty">
              <ScanSearch size={22} />
              <p>{t('reverse.result.empty')}</p>
            </div>
          ) : (
            <>
              <div className="reverse-result-meta">
                <span className="badge mono">{modeBadge(result.mode)}</span>
                <span className="mono reverse-source">{result.sourceLabel}</span>
              </div>
              {result.warnings.length > 0 && (
                <ul className="reverse-warnings">
                  {result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
              <pre className="reverse-result-prompt">{result.prompt}</pre>
              {result.tags.length > 0 && (
                <div className="param-row">
                  {result.tags.map((tag) => (
                    <span key={tag} className="badge">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="reverse-result-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={copyPrompt}>
                  <Copy size={14} /> {t('reverse.copy')}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={sendToCanvas}>
                  <LayoutGrid size={14} /> {t('reverse.toCanvas')}
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={sendToCreate}>
                  <ArrowRight size={14} /> {t('reverse.toCreate')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReversePage;
