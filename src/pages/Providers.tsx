import React, { useState } from 'react';
import {
  Plus,
  CheckCircle2,
  XCircle,
  Link2,
  KeyRound,
  Cpu,
  Trash2,
  Pencil,
  Power,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGeneration } from '../state/GenerationContext';
import {
  useProviders,
  parseModelsText,
  modelsToText,
  type Provider,
} from '../state/ProvidersContext';
import { useI18n } from '../i18n/useI18n';

const ProvidersPage = () => {
  const { providers, addProvider, updateProvider, removeProvider, setProviderStatus } =
    useProviders();
  const { pushToast } = useGeneration();
  const { t, statusLabel } = useI18n();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelsText, setModelsText] = useState('dall-e-3|DALL·E 3');
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const resetForm = () => {
    setName('');
    setUrl('');
    setApiKey('');
    setModelsText('dall-e-3|DALL·E 3');
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (p: Provider) => {
    setEditingId(p.id);
    setName(p.name);
    setUrl(p.baseUrl);
    setApiKey(p.apiKey);
    setModelsText(modelsToText(p.models) || '');
    setShowForm(true);
  };

  const fetchModels = async () => {
    if (!url.trim() || !apiKey.trim()) {
      pushToast({ tone: 'error', title: t('providers.toast.needUrl') });
      return null;
    }
    const response = await fetch('/api/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl: url.trim(), apiKey: apiKey.trim() }),
    });
    const result = await response.json() as { models?: { id: string; label?: string; kind: 'image' | 'video' | 'vision' }[]; error?: string };
    if (!response.ok || !result.models) throw new Error(result.error || 'Unable to read the model list.');
    return result.models;
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const models = await fetchModels();
      if (models) pushToast({ tone: 'success', title: `Connection succeeded: ${models.length} usable models found` });
    } catch (error) {
      pushToast({ tone: 'error', title: error instanceof Error ? error.message : 'Connection failed.' });
    } finally {
      setTesting(false);
    }
  };

  const syncModels = async () => {
    setSyncing(true);
    try {
      const models = await fetchModels();
      if (!models) return;
      setModelsText(models.map((m) => `${m.id}|${m.label ?? m.id}|${m.kind}`).join('\n'));
      pushToast({ tone: 'success', title: `Synced ${models.length} models` });
    } catch (error) {
      pushToast({ tone: 'error', title: error instanceof Error ? error.message : 'Model sync failed.' });
    } finally {
      setSyncing(false);
    }
  };

  const saveProvider = () => {
    if (!name.trim() || !url.trim()) {
      pushToast({ tone: 'error', title: t('providers.toast.needFields') });
      return;
    }
    const models = parseModelsText(modelsText);
    if (models.length === 0) {
      pushToast({ tone: 'error', title: t('providers.toast.needModels') });
      return;
    }

    if (editingId) {
      updateProvider(editingId, {
        name: name.trim(),
        baseUrl: url.trim(),
        apiKey,
        models,
      });
      pushToast({
        tone: 'success',
        title: t('providers.toast.updated'),
        body: name.trim(),
      });
    } else {
      const created = addProvider({
        name,
        baseUrl: url,
        apiKey,
        modelsText,
        status: 'connected',
      });
      if (!created) {
        pushToast({ tone: 'error', title: t('providers.toast.needFields') });
        return;
      }
      pushToast({
        tone: 'success',
        title: t('providers.toast.saved'),
        body: created.name,
      });
    }
    resetForm();
    setShowForm(false);
  };

  const deleteProvider = (p: Provider) => {
    const ok = window.confirm(t('providers.delete.confirm', { name: p.name }));
    if (!ok) return;
    removeProvider(p.id);
    if (editingId === p.id) {
      resetForm();
      setShowForm(false);
    }
    pushToast({
      tone: 'info',
      title: t('providers.toast.deleted'),
      body: p.name,
    });
  };

  return (
    <div className="providers-page">
      <header className="page-header">
        <div className="page-header-text">
          <div className="page-kicker">{t('providers.kicker')}</div>
          <h1 className="page-title">{t('providers.title')}</h1>
          <p className="page-desc">{t('providers.desc')}</p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => (showForm && !editingId ? (setShowForm(false), resetForm()) : openCreate())}
          aria-expanded={showForm}
        >
          <Plus size={16} />{' '}
          {showForm && !editingId ? t('providers.close') : t('providers.add')}
        </button>
      </header>

      {showForm && (
        <div className="card provider-form">
          <h3 className="provider-form-title">
            {editingId ? t('providers.edit') : t('providers.new')}
          </h3>
          <div className="form-grid form-grid-tight">
            <div className="form-group">
              <label htmlFor="p-name">{t('providers.name')}</label>
              <input
                id="p-name"
                type="text"
                placeholder={t('providers.name.ph')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="p-url">{t('providers.url')}</label>
              <input
                id="p-url"
                type="url"
                placeholder="https://api.example.com/v1"
                className="mono"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="form-group form-span-2">
              <label htmlFor="p-key">{t('providers.key')}</label>
              <div className="input-with-icon">
                <KeyRound size={15} />
                <input
                  id="p-key"
                  type="password"
                  placeholder="sk-…"
                  className="mono"
                  autoComplete="off"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
              <p className="form-field-hint">{t('providers.key.hint')}</p>
            </div>
            <div className="form-group form-span-2">
              <label htmlFor="p-models">{t('providers.models')}</label>
              <textarea
                id="p-models"
                rows={3}
                className="mono"
                placeholder={t('providers.models.ph')}
                value={modelsText}
                onChange={(e) => setModelsText(e.target.value)}
              />
              <p className="form-field-hint">{t('providers.models.hint')}</p>
            </div>
          </div>
          <div className="provider-form-actions">
            <button type="button" className="btn btn-secondary" onClick={syncModels} disabled={syncing}>
              {syncing ? 'Syncing…' : 'Sync image/video models'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={testConnection}
              disabled={testing}
            >
              {testing ? t('providers.testing') : t('providers.test')}
            </button>
            <button type="button" className="btn btn-primary" onClick={saveProvider}>
              {editingId ? t('providers.saveEdit') : t('providers.save')}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                {t('common.cancel')}
              </button>
            )}
          </div>
        </div>
      )}

      {providers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Cpu size={22} />
          </div>
          <div className="empty-state-title">{t('providers.empty.title')}</div>
          <p className="empty-state-desc">{t('providers.empty.desc')}</p>
          {!showForm && (
            <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
              <Plus size={14} /> {t('providers.add')}
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="providers-create-hint">
            {t('providers.createHint')}{' '}
            <Link to="/" className="text-link">
              {t('app.nav.create')}
            </Link>
          </p>
          <div className="provider-list">
            {providers.map((p) => (
              <div key={p.id} className="card provider-row">
                <div className="provider-left">
                  <span className="provider-icon" aria-hidden>
                    {p.status === 'connected' ? (
                      <CheckCircle2 size={20} color="var(--status-success)" />
                    ) : (
                      <XCircle size={20} color="var(--status-failed)" />
                    )}
                  </span>
                  <div>
                    <div className="provider-name">
                      {p.name}{' '}
                      <span
                        className={`status-pill ${p.status === 'connected' ? 'success' : 'failed'}`}
                      >
                        {statusLabel(p.status)}
                      </span>
                    </div>
                    <div className="provider-url">
                      <Link2 size={12} /> {p.baseUrl}
                    </div>
                    <div className="provider-key-mask mono">
                      {p.apiKey
                        ? `${t('providers.key')}: ${'•'.repeat(Math.min(12, p.apiKey.length))}`
                        : t('providers.key.empty')}
                    </div>
                  </div>
                </div>
                <div className="provider-models">
                  {p.models.length === 0 ? (
                    <span className="badge">{t('providers.models.none')}</span>
                  ) : (
                    p.models.map((m) => (
                      <span key={m.id} className="badge badge-chip mono" title={m.id}>
                        {m.label}{m.kind ? ` · ${m.kind}` : ''}
                      </span>
                    ))
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      setProviderStatus(
                        p.id,
                        p.status === 'connected' ? 'disconnected' : 'connected',
                      )
                    }
                    title={
                      p.status === 'connected'
                        ? t('providers.disconnect')
                        : t('providers.connect')
                    }
                  >
                    <Power size={14} />
                    <span>
                      {p.status === 'connected'
                        ? t('providers.disconnect')
                        : t('providers.connect')}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => openEdit(p)}
                  >
                    <Pencil size={14} />
                    <span>{t('providers.edit')}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => deleteProvider(p)}
                    title={t('providers.delete')}
                  >
                    <Trash2 size={14} />
                    <span>{t('providers.delete')}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ProvidersPage;
