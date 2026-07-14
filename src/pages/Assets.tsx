import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { animate, stagger } from 'animejs';
import {
  Download,
  RefreshCw,
  PlayCircle,
  Image as ImageIcon,
  Film,
  Inbox,
  Sparkles,
  Trash2,
  FolderPlus,
  FolderOpen,
  Layers,
  PanelRight,
} from 'lucide-react';
import { useGeneration, type LibraryAsset } from '../state/GenerationContext';
import { useI18n } from '../i18n/useI18n';
import AssetDetailDrawer from '../components/AssetDetailDrawer';
import { recipeFromAsset, type CreateLocationState } from '../lib/recipe';

type TypeFilter = 'all' | 'image' | 'video';
/** 'all' | 'uncategorized' | category id */
type CategoryFilter = 'all' | 'uncategorized' | string;

type ViewAsset = {
  id: string;
  type: 'image' | 'video';
  model: string;
  time: string;
  dim: string;
  ratio: '1/1' | '16/9' | '9/16';
  prompt: string;
  hue: number;
  fresh: boolean;
  categoryId: string | null;
  source: LibraryAsset;
};

const AssetsPage = () => {
  const gridRef = useRef<HTMLDivElement>(null);
  const hoverPreviewRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef(new Map<string, HTMLButtonElement>());
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [groupByCategory, setGroupByCategory] = useState(true);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [previewRatio, setPreviewRatio] = useState<string | null>(null);
  const [previewPosition, setPreviewPosition] = useState<{ top: number; left: number } | null>(null);
  const {
    library,
    categories,
    removeAsset,
    updateAssetDimensions,
    setAssetCategory,
    addCategory,
    removeCategory,
    pushToast,
  } = useGeneration();
  const navigate = useNavigate();
  const { t } = useI18n();

  const categoryName = (id: string | null) => {
    if (!id) return t('assets.category.uncategorized');
    return categories.find((c) => c.id === id)?.name ?? t('assets.category.uncategorized');
  };

  const detailAsset = detailId
    ? library.find((a) => a.id === detailId) ?? null
    : null;
  const hoverAsset = !detailAsset && hoveredId ? library.find((a) => a.id === hoveredId) ?? null : null;

  const handleDelete = (id: string) => {
    const ok = window.confirm(t('assets.delete.confirm', { id }));
    if (!ok) return;
    removeAsset(id);
    if (detailId === id) setDetailId(null);
    pushToast({
      tone: 'info',
      title: t('assets.toast.deleted'),
      body: id,
    });
  };

  const handleReuse = (asset: LibraryAsset) => {
    const recipe = recipeFromAsset(asset);
    const state: CreateLocationState = {
      reuse: recipe,
      reuseFrom: asset.id,
    };
    navigate('/', { state });
  };

  const handleCopyImage = async (asset: LibraryAsset) => {
    if (asset.type !== 'image' || !asset.url) return;
    try {
      const response = await fetch(asset.url);
      const image = await response.blob();
      if (!response.ok || !image.type.startsWith('image/')) throw new Error('Image fetch failed');
      await navigator.clipboard.write([new ClipboardItem({ [image.type]: image })]);
      pushToast({ tone: 'success', title: t('assets.detail.copyImage.ok') });
    } catch {
      pushToast({ tone: 'error', title: t('assets.detail.copyImage.fail') });
    }
  };

  const handleUseAsReference = (asset: LibraryAsset) => {
    if (asset.type !== 'image' || !asset.url) return;
    const extension = asset.url.split('?')[0].match(/\.(png|jpe?g|webp)$/i)?.[1] ?? 'png';
    const state: CreateLocationState = {
      references: [{ name: `${asset.id}.${extension}`, url: asset.url, kind: 'image' }],
    };
    navigate('/', { state });
  };

  const handleSendToCanvas = (asset: LibraryAsset) => {
    navigate('/canvas', { state: { addAssetId: asset.id } });
  };

  const handleCreateCategory = () => {
    const name = newCatName.trim();
    if (!name) {
      pushToast({ tone: 'error', title: t('assets.category.toast.needName') });
      return;
    }
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      pushToast({ tone: 'error', title: t('assets.category.toast.dup') });
      return;
    }
    const created = addCategory(name);
    if (!created) {
      pushToast({ tone: 'error', title: t('assets.category.toast.dup') });
      return;
    }
    pushToast({
      tone: 'success',
      title: t('assets.category.toast.created'),
      body: created.name,
    });
    setNewCatName('');
    setShowNewCat(false);
    setCategoryFilter(created.id);
  };

  const handleDeleteCategory = (id: string, name: string) => {
    const ok = window.confirm(t('assets.category.delete.confirm', { name }));
    if (!ok) return;
    removeCategory(id);
    if (categoryFilter === id) setCategoryFilter('all');
    pushToast({
      tone: 'info',
      title: t('assets.category.toast.deleted'),
      body: name,
    });
  };

  const handleMove = (assetId: string, next: string) => {
    const categoryId = next === '' ? null : next;
    setAssetCategory(assetId, categoryId);
    pushToast({
      tone: 'info',
      title: t('assets.category.toast.moved', {
        name: categoryName(categoryId),
      }),
    });
  };

  const relativeTime = (ts: number) => {
    const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return t('assets.time.s', { n: s });
    if (s < 3600) return t('assets.time.m', { n: Math.floor(s / 60) });
    return t('assets.time.h', { n: Math.floor(s / 3600) });
  };

  const counts = useMemo(() => {
    const uncategorized = library.filter((a) => !a.categoryId).length;
    const byId: Record<string, number> = {};
    for (const c of categories) byId[c.id] = 0;
    for (const a of library) {
      if (a.categoryId && byId[a.categoryId] !== undefined) {
        byId[a.categoryId] += 1;
      } else if (a.categoryId) {
        // orphaned category id
        uncategorized; // stay uncategorized count separately
      }
    }
    // recount orphaned as uncategorized for display
    let orphan = 0;
    for (const a of library) {
      if (a.categoryId && !categories.some((c) => c.id === a.categoryId)) orphan += 1;
    }
    return {
      all: library.length,
      uncategorized: library.filter(
        (a) => !a.categoryId || !categories.some((c) => c.id === a.categoryId),
      ).length,
      byId,
    };
  }, [library, categories]);

  const assets: ViewAsset[] = useMemo(() => {
    let list = library.map((a: LibraryAsset) => ({
      id: a.id,
      type: a.type,
      model: a.model,
      time: relativeTime(a.createdAt),
      dim: a.dim,
      ratio: a.ratio,
      prompt: a.prompt,
      hue: a.hue,
      fresh: Date.now() - a.createdAt < 60_000,
      categoryId:
        a.categoryId && categories.some((c) => c.id === a.categoryId)
          ? a.categoryId
          : null,
      source: a,
    }));

    if (typeFilter !== 'all') {
      list = list.filter((a) => a.type === typeFilter);
    }
    if (categoryFilter === 'uncategorized') {
      list = list.filter((a) => !a.categoryId);
    } else if (categoryFilter !== 'all') {
      list = list.filter((a) => a.categoryId === categoryFilter);
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library, typeFilter, categoryFilter, categories, t]);

  const groups = useMemo(() => {
    if (!groupByCategory || categoryFilter !== 'all') {
      return [{ key: categoryFilter, title: null as string | null, items: assets }];
    }
    const order: { key: string; title: string; items: ViewAsset[] }[] = [];
    const uncategorized = assets.filter((a) => !a.categoryId);
    if (uncategorized.length) {
      order.push({
        key: 'uncategorized',
        title: t('assets.category.uncategorized'),
        items: uncategorized,
      });
    }
    for (const c of categories) {
      const items = assets.filter((a) => a.categoryId === c.id);
      if (items.length) {
        order.push({ key: c.id, title: c.name, items });
      }
    }
    if (order.length === 0 && assets.length === 0) {
      return [{ key: 'empty', title: null, items: [] }];
    }
    return order;
  }, [assets, groupByCategory, categoryFilter, categories, t]);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (gridRef.current && !prefersReduced && assets.length > 0) {
      animate(gridRef.current.querySelectorAll('.asset-card'), {
        scale: [0.97, 1],
        opacity: [0, 1],
        duration: 320,
        delay: stagger(35),
        ease: 'outCubic',
      });
    }
  }, [typeFilter, categoryFilter, library.length, assets.length, groupByCategory]);

  useEffect(() => {
    if (!hoverPreviewRef.current || !hoverAsset || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    animate(hoverPreviewRef.current, {
      opacity: [0, 1],
      translateX: [32, 0],
      scale: [0.985, 1],
      duration: 420,
      ease: 'outExpo',
    });
  }, [hoverAsset]);

  useEffect(() => {
    if (!hoveredId) return;
    const updatePosition = () => {
      const rect = thumbRefs.current.get(hoveredId)?.getBoundingClientRect();
      if (!rect) return;
      setPreviewPosition({
        left: Math.min(rect.right + 16, window.innerWidth - 380),
        top: Math.max(16, Math.min(rect.top, window.innerHeight - 430)),
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [hoveredId]);

  useEffect(() => {
    if (!hoverAsset || !hoverPreviewRef.current || !previewPosition) return;
    const frame = requestAnimationFrame(() => {
      const runwayTop = document.querySelector('.runway-container')?.getBoundingClientRect().top ?? window.innerHeight;
      const previewRect = hoverPreviewRef.current?.getBoundingClientRect();
      if (!previewRect) return;
      const top = Math.max(16, Math.min(previewPosition.top, runwayTop - previewRect.height - 16));
      if (Math.abs(top - previewPosition.top) > 1) {
        setPreviewPosition((current) => current ? { ...current, top } : current);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [hoverAsset, previewPosition, previewRatio]);

  const filterLabel = (f: TypeFilter) => {
    if (f === 'all') return t('common.all');
    if (f === 'image') return t('common.image');
    return t('common.video');
  };

  const renderCard = (asset: ViewAsset) => (
    <article
      key={asset.id}
      className={`card asset-card ${asset.fresh ? 'is-fresh' : ''} ${detailId === asset.id ? 'is-selected' : ''}`}
    >
      <button
        type="button"
        ref={(node) => {
          if (node) thumbRefs.current.set(asset.id, node);
          else thumbRefs.current.delete(asset.id);
        }}
        className="asset-thumb asset-thumb-btn"
        data-ratio={asset.ratio}
        style={{ '--asset-hue': String(asset.hue ?? 72) } as React.CSSProperties}
        onClick={() => setDetailId(asset.id)}
        onMouseEnter={() => {
          setPreviewRatio(null);
          setHoveredId(asset.id);
        }}
        onMouseLeave={() => {
          setHoveredId((current) => (current === asset.id ? null : current));
          setPreviewPosition(null);
        }}
        onFocus={() => {
          setPreviewRatio(null);
          setHoveredId(asset.id);
        }}
        onBlur={() => {
          setHoveredId((current) => (current === asset.id ? null : current));
          setPreviewPosition(null);
        }}
        title={t('assets.detail.open')}
      >
        {asset.source.url ? asset.type === 'video' ? (
          <video className="asset-art" src={asset.source.url} muted loop autoPlay playsInline onLoadedMetadata={(e) => updateAssetDimensions(asset.id, e.currentTarget.videoWidth, e.currentTarget.videoHeight)} />
        ) : (
          <img className="asset-art" src={asset.source.url} alt="" onLoad={(e) => updateAssetDimensions(asset.id, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)} />
        ) : <div className="asset-art" aria-hidden />}
        <span className="badge asset-type-badge">
          {asset.type === 'video' ? (
            <>
              <Film size={11} /> {t('common.video')}
            </>
          ) : (
            <>
              <ImageIcon size={11} /> {t('common.image')}
            </>
          )}
        </span>
        {asset.fresh && (
          <span className="badge asset-fresh-badge">
            <Sparkles size={11} /> {t('common.new')}
          </span>
        )}
        {asset.type === 'video' ? (
          <div className="asset-play" aria-hidden>
            <PlayCircle size={28} strokeWidth={1.4} />
          </div>
        ) : null}
      </button>

      <div className="asset-body">
        <div className="asset-meta-row">
          <button
            type="button"
            className="mono asset-id-link"
            onClick={() => setDetailId(asset.id)}
          >
            {asset.id}
          </button>
          <span className="dim mono tabular">{asset.dim}</span>
        </div>
        <div className="asset-sub">
          {asset.model} · {asset.time}
        </div>
        <div className="asset-prompt" title={asset.prompt}>
          {asset.prompt}
        </div>

        <label className="asset-category-field">
          <span className="asset-category-label">{t('assets.category.move')}</span>
          <select
            className="asset-category-select mono"
            value={asset.categoryId ?? ''}
            onChange={(e) => handleMove(asset.id, e.target.value)}
          >
            <option value="">{t('assets.category.uncategorized')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="asset-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => handleReuse(asset.source)}
          >
            <RefreshCw size={13} /> {t('assets.reuse')}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setDetailId(asset.id)}
            title={t('assets.detail.open')}
          >
            <PanelRight size={13} />
          </button>
          {asset.source.url && <a className="btn btn-secondary btn-sm" href={asset.source.url} download><Download size={13} /> {t('assets.save')}</a>}
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => handleDelete(asset.id)}
            title={t('assets.delete')}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </article>
  );

  return (
    <div className="assets-page">
      <header className="page-header">
        <div className="page-header-text">
          <div className="page-kicker">{t('assets.kicker')}</div>
          <h1 className="page-title">{t('assets.title')}</h1>
          <p className="page-desc">{t('assets.desc')}</p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowNewCat((v) => !v)}
          >
            <FolderPlus size={14} /> {t('assets.category.new')}
          </button>
          <Link to="/" className="btn btn-primary btn-sm">
            {t('common.newGeneration')}
          </Link>
        </div>
      </header>

      {showNewCat && (
        <div className="card category-create-bar">
          <FolderOpen size={16} className="category-create-icon" />
          <input
            type="text"
            className="category-create-input"
            placeholder={t('assets.category.name.ph')}
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateCategory();
            }}
            autoFocus
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={handleCreateCategory}>
            {t('assets.category.create')}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setShowNewCat(false);
              setNewCatName('');
            }}
          >
            {t('common.cancel')}
          </button>
        </div>
      )}

      <div className="assets-toolbar">
        <div
          className="type-selector type-selector-inline"
          role="tablist"
          aria-label={t('assets.filter')}
        >
          {(['all', 'image', 'video'] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={typeFilter === f}
              className={`type-btn ${typeFilter === f ? 'active' : ''}`}
              onClick={() => setTypeFilter(f)}
            >
              {filterLabel(f)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`btn btn-sm ${groupByCategory ? 'btn-secondary' : 'btn-ghost'} group-toggle`}
          onClick={() => setGroupByCategory((v) => !v)}
          aria-pressed={groupByCategory}
          title={t('assets.group.by')}
        >
          <Layers size={14} />
          <span>{t('assets.group.by')}</span>
        </button>
        <span className="badge mono tabular ml-auto">
          {t('common.items', { n: assets.length })}
        </span>
      </div>

      <div className="category-rail" role="tablist" aria-label={t('assets.category')}>
        <button
          type="button"
          role="tab"
          className={`category-chip ${categoryFilter === 'all' ? 'active' : ''}`}
          aria-selected={categoryFilter === 'all'}
          onClick={() => setCategoryFilter('all')}
        >
          {t('assets.category.all')}
          <span className="category-chip-count mono">{counts.all}</span>
        </button>
        <button
          type="button"
          role="tab"
          className={`category-chip ${categoryFilter === 'uncategorized' ? 'active' : ''}`}
          aria-selected={categoryFilter === 'uncategorized'}
          onClick={() => setCategoryFilter('uncategorized')}
        >
          {t('assets.category.uncategorized')}
          <span className="category-chip-count mono">{counts.uncategorized}</span>
        </button>
        {categories.map((c) => (
          <div key={c.id} className="category-chip-wrap">
            <button
              type="button"
              role="tab"
              className={`category-chip ${categoryFilter === c.id ? 'active' : ''}`}
              aria-selected={categoryFilter === c.id}
              onClick={() => setCategoryFilter(c.id)}
            >
              {c.name}
              <span className="category-chip-count mono">{counts.byId[c.id] ?? 0}</span>
            </button>
            <button
              type="button"
              className="category-chip-delete"
              title={t('assets.category.delete')}
              onClick={() => handleDeleteCategory(c.id, c.name)}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {library.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Inbox size={22} />
          </div>
          <div className="empty-state-title">{t('assets.empty.title')}</div>
          <p className="empty-state-desc">{t('assets.empty.desc')}</p>
          <Link to="/" className="btn btn-primary btn-sm">
            {t('assets.empty.cta')}
          </Link>
        </div>
      ) : assets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <FolderOpen size={22} />
          </div>
          <div className="empty-state-title">{t('assets.category.empty')}</div>
          <p className="empty-state-desc">{t('assets.category.empty')}</p>
        </div>
      ) : (
        <div ref={gridRef}>
          {groups.map((group) => (
            <section key={group.key} className="asset-group">
              {group.title && (
                <header className="asset-group-header">
                  <h2 className="asset-group-title">{group.title}</h2>
                  <span className="badge mono tabular">
                    {t('common.items', { n: group.items.length })}
                  </span>
                </header>
              )}
              <div className="assets-grid">{group.items.map(renderCard)}</div>
            </section>
          ))}
        </div>
      )}

      <AssetDetailDrawer
        asset={detailAsset}
        categoryLabel={categoryName(detailAsset?.categoryId ?? null)}
        onClose={() => setDetailId(null)}
        onReuse={(a) => {
          setDetailId(null);
          handleReuse(a);
        }}
        onCopyImage={handleCopyImage}
        onUseAsReference={handleUseAsReference}
        onSendToCanvas={handleSendToCanvas}
        onDelete={handleDelete}
      />
      {hoverAsset && previewPosition && createPortal(
        <aside
          className="asset-hover-preview"
          ref={hoverPreviewRef}
          aria-hidden="true"
          style={{ left: previewPosition.left, top: previewPosition.top }}
        >
          <div className="asset-hover-preview-head">
            <span className="mono">PREVIEW</span>
            <span className="mono">{hoverAsset.dim}</span>
          </div>
          <div className="asset-hover-preview-media" data-ratio={hoverAsset.ratio} style={previewRatio ? { aspectRatio: previewRatio } : undefined}>
            {hoverAsset.url ? hoverAsset.type === 'video' ? (
              <video src={hoverAsset.url} muted loop autoPlay playsInline onLoadedMetadata={(e) => setPreviewRatio(`${e.currentTarget.videoWidth} / ${e.currentTarget.videoHeight}`)} />
            ) : (
              <img src={hoverAsset.url} alt="" onLoad={(e) => setPreviewRatio(`${e.currentTarget.naturalWidth} / ${e.currentTarget.naturalHeight}`)} />
            ) : <div className="asset-art" aria-hidden />}
          </div>
          <p>{hoverAsset.prompt}</p>
        </aside>,
        document.body,
      )}
    </div>
  );
};

export default AssetsPage;
