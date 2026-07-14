import React, { useEffect, useState } from 'react';
import {
  X,
  RefreshCw,
  Copy,
  Film,
  Image as ImageIcon,
  Trash2,
  LayoutGrid,
} from 'lucide-react';
import type { LibraryAsset } from '../state/GenerationContext';
import { recipeFromAsset } from '../lib/recipe';
import { useI18n } from '../i18n/useI18n';

type Props = {
  asset: LibraryAsset | null;
  categoryLabel: string;
  onClose: () => void;
  onReuse: (asset: LibraryAsset) => void;
  onCopyImage: (asset: LibraryAsset) => Promise<void>;
  onUseAsReference: (asset: LibraryAsset) => void;
  onDelete: (id: string) => void;
  /** Optional: send asset into generation canvas */
  onSendToCanvas?: (asset: LibraryAsset) => void;
};

export default function AssetDetailDrawer({
  asset,
  categoryLabel,
  onClose,
  onReuse,
  onCopyImage,
  onUseAsReference,
  onDelete,
  onSendToCanvas,
}: Props) {
  const { t } = useI18n();
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!asset) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxOpen) setLightboxOpen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [asset, lightboxOpen, onClose]);

  useEffect(() => setLightboxOpen(false), [asset?.id]);

  if (!asset) return null;

  const recipe = recipeFromAsset(asset);

  const rows: { label: string; value: string }[] = [
    { label: t('assets.detail.id'), value: asset.id },
    { label: t('assets.detail.job'), value: asset.jobId || '—' },
    { label: t('assets.detail.type'), value: recipe.type },
    { label: t('assets.detail.model'), value: recipe.model },
    { label: t('assets.detail.ratio'), value: recipe.ratio },
    {
      label: t('assets.detail.quality'),
      value: recipe.quality
        ? recipe.quality === 'high'
          ? t('create.quality.high')
          : t('create.quality.standard')
        : '—',
    },
    {
      label: t('assets.detail.seed'),
      value: recipe.seed?.trim() ? recipe.seed : t('common.random'),
    },
    {
      label: t('assets.detail.duration'),
      value:
        recipe.type === 'video' && recipe.duration != null
          ? `${recipe.duration}s`
          : '—',
    },
    { label: t('assets.detail.dim'), value: asset.dim },
    { label: t('assets.detail.category'), value: categoryLabel },
    {
      label: t('assets.detail.created'),
      value: new Date(asset.createdAt).toLocaleString(),
    },
  ];

  return (
    <div className="asset-detail-overlay" role="dialog" aria-modal="true" aria-label={t('assets.detail.title')}>
      <button
        type="button"
        className="asset-detail-backdrop"
        onClick={onClose}
        aria-label={t('common.dismiss')}
      />
      <div className="asset-detail-panel">
        <header className="asset-detail-header">
          <div>
            <div className="page-kicker">{t('assets.detail.kicker')}</div>
            <h2 className="asset-detail-title mono">{asset.id}</h2>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </header>

        <div className="asset-detail-body">
          <button
            type="button"
            className="asset-detail-thumb asset-detail-media"
            data-ratio={asset.ratio}
            style={{ '--asset-hue': String(asset.hue) } as React.CSSProperties}
            onClick={() => asset.type === 'image' && asset.url && setLightboxOpen(true)}
            disabled={!asset.url || asset.type === 'video'}
            aria-label="Open full-size image"
          >
            {asset.url ? asset.type === 'video' ? <video className="asset-art" src={asset.url} muted loop autoPlay playsInline controls /> : <img className="asset-art" src={asset.url} alt={recipe.prompt || asset.id} /> : <div className="asset-art" aria-hidden />}
            <span className="badge asset-type-badge">
              {asset.type === 'video' ? (
                <>
                  <Film size={12} /> {t('common.video')}
                </>
              ) : (
                <>
                  <ImageIcon size={12} /> {t('common.image')}
                </>
              )}
            </span>
          </button>

          <section className="asset-detail-section">
            <div className="asset-detail-section-head">
              <h3>{t('create.prompt')}</h3>
              {asset.type === 'image' && asset.url && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void onCopyImage(asset)}>
                  <Copy size={13} /> {t('assets.detail.copyImage')}
                </button>
              )}
            </div>
            <pre className="asset-detail-prompt">{recipe.prompt || '—'}</pre>
          </section>

          <section className="asset-detail-section">
            <h3>{t('create.params')}</h3>
            <dl className="asset-detail-grid">
              {rows.map((row) => (
                <div key={row.label} className="asset-detail-row">
                  <dt>{row.label}</dt>
                  <dd className="mono">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <footer className="asset-detail-footer">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onReuse(asset)}
          >
            <RefreshCw size={14} /> {t('assets.reuse')}
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => onDelete(asset.id)}
          >
            <Trash2 size={14} /> {t('assets.delete')}
          </button>
          {onSendToCanvas && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onSendToCanvas(asset)}
            >
              <LayoutGrid size={14} /> {t('assets.detail.toCanvas')}
            </button>
          )}
          {asset.type === 'image' && asset.url && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ marginLeft: onSendToCanvas ? undefined : 'auto' }}
              onClick={() => onUseAsReference(asset)}
            >
              <ImageIcon size={14} /> {t('assets.detail.useReference')}
            </button>
          )}
        </footer>
      </div>
      {lightboxOpen && asset.type === 'image' && asset.url && (
        <div className="asset-lightbox" role="dialog" aria-modal="true" aria-label="Full-size image">
          <button type="button" className="asset-lightbox-backdrop" onClick={() => setLightboxOpen(false)} aria-label="Close full-size image" />
          <figure className="asset-lightbox-frame">
            <button type="button" className="asset-lightbox-close" onClick={() => setLightboxOpen(false)} aria-label="Close full-size image">
              <X size={18} />
            </button>
            <img className="asset-lightbox-image" src={asset.url} alt={recipe.prompt || asset.id} />
          </figure>
        </div>
      )}
    </div>
  );
}
