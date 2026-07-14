import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookMarked,
  Search,
  Star,
  X,
  Trash2,
  Plus,
  CornerDownLeft,
  Layers,
} from 'lucide-react';
import {
  PROMPT_CATEGORY_ORDER,
  normalizeRatio,
  pickLocalized,
  type PromptCategoryId,
  type PromptTemplate,
  type UserPrompt,
} from '../data/promptLibrary';
import { usePromptLibrary } from '../state/PromptLibraryContext';
import { useI18n } from '../i18n/useI18n';
import type { Locale } from '../i18n/locales';

export type ApplyPromptPayload = {
  body: string;
  ratio?: '1:1' | '16:9' | '9:16';
  mode: 'replace' | 'append';
};

type Props = {
  open: boolean;
  onClose: () => void;
  onApply: (payload: ApplyPromptPayload) => void;
  currentPrompt: string;
};

type FlatItem =
  | { kind: 'builtin'; data: PromptTemplate }
  | { kind: 'user'; data: UserPrompt };

export default function PromptLibrary({
  open,
  onClose,
  onApply,
  currentPrompt,
}: Props) {
  const { t, locale } = useI18n();
  const {
    builtins,
    userPrompts,
    addUserPrompt,
    removeUserPrompt,
    toggleFavorite,
    isFavorite,
  } = usePromptLibrary();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | 'favorites' | 'mine' | PromptCategoryId>(
    'all',
  );
  const [applyMode, setApplyMode] = useState<'replace' | 'append'>('replace');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const tmr = window.setTimeout(() => searchRef.current?.focus(), 50);
    return () => window.clearTimeout(tmr);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const categoryLabel = (id: PromptCategoryId | 'custom') => {
    if (id === 'custom') return t('prompts.cat.custom');
    return t(`prompts.cat.${id}`);
  };

  const items: FlatItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchText = (s: string) => !q || s.toLowerCase().includes(q);

    const builtinItems: FlatItem[] = builtins
      .filter((p) => {
        if (category === 'mine') return false;
        if (category === 'favorites') return isFavorite(p.id);
        if (category !== 'all' && p.category !== category) return false;
        const title = pickLocalized(p.title, locale as Locale);
        const body = pickLocalized(p.body, locale as Locale);
        const tags = pickLocalized(p.tags, locale as Locale);
        return matchText(title) || matchText(body) || matchText(tags);
      })
      .map((data) => ({ kind: 'builtin' as const, data }));

    const userItems: FlatItem[] = userPrompts
      .filter((p) => {
        const textOk = matchText(p.title) || matchText(p.body);
        if (!textOk) return false;
        if (category === 'favorites') return isFavorite(p.id);
        if (category === 'mine' || category === 'all') return true;
        return p.category === category;
      })
      .map((data) => ({ kind: 'user' as const, data }));

    // Favorites / all: merge user first when mine, else builtins then user
    if (category === 'mine') return userItems;
    if (category === 'favorites') return [...userItems, ...builtinItems];
    return [...builtinItems, ...userItems];
  }, [builtins, userPrompts, category, query, locale, isFavorite]);

  const preview = useMemo(() => {
    if (!previewId) return items[0] ?? null;
    return items.find((i) => i.data.id === previewId) ?? items[0] ?? null;
  }, [items, previewId]);

  useEffect(() => {
    if (preview) setPreviewId(preview.data.id);
    else setPreviewId(null);
  }, [category, query]); // reset selection when filters change

  const getBody = (item: FlatItem) =>
    item.kind === 'builtin'
      ? pickLocalized(item.data.body, locale as Locale)
      : item.data.body;

  const getTitle = (item: FlatItem) =>
    item.kind === 'builtin'
      ? pickLocalized(item.data.title, locale as Locale)
      : item.data.title;

  const applyItem = (item: FlatItem) => {
    const body = getBody(item);
    const ratio =
      item.kind === 'builtin' ? normalizeRatio(item.data.ratio as string | undefined) : undefined;
    onApply({ body, ratio, mode: applyMode });
    onClose();
  };

  const saveCurrent = () => {
    const body = currentPrompt.trim();
    if (!body) return;
    const created = addUserPrompt({
      title: body.slice(0, 36),
      body,
      category: 'custom',
    });
    if (created) {
      setCategory('mine');
      setPreviewId(created.id);
    }
  };

  if (!open) return null;

  return (
    <div className="prompt-lib-overlay" role="dialog" aria-modal="true" aria-label={t('prompts.title')}>
      <button type="button" className="prompt-lib-backdrop" onClick={onClose} aria-label={t('common.dismiss')} />
      <div className="prompt-lib-panel" ref={panelRef}>
        <header className="prompt-lib-header">
          <div className="prompt-lib-header-text">
            <div className="prompt-lib-kicker mono">
              <BookMarked size={14} /> {t('prompts.kicker')}
            </div>
            <h2 className="prompt-lib-title">{t('prompts.title')}</h2>
            <p className="prompt-lib-desc">{t('prompts.desc')}</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label={t('common.dismiss')}>
            <X size={16} />
          </button>
        </header>

        <div className="prompt-lib-toolbar">
          <div className="prompt-lib-search">
            <Search size={14} />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('prompts.search.ph')}
            />
          </div>
          <div className="prompt-lib-mode" role="group" aria-label={t('prompts.applyMode')}>
            <button
              type="button"
              className={`prompt-mode-btn ${applyMode === 'replace' ? 'active' : ''}`}
              onClick={() => setApplyMode('replace')}
            >
              {t('prompts.mode.replace')}
            </button>
            <button
              type="button"
              className={`prompt-mode-btn ${applyMode === 'append' ? 'active' : ''}`}
              onClick={() => setApplyMode('append')}
            >
              {t('prompts.mode.append')}
            </button>
          </div>
        </div>

        <div className="prompt-lib-cats" role="tablist">
          <button
            type="button"
            className={`category-chip ${category === 'all' ? 'active' : ''}`}
            onClick={() => setCategory('all')}
          >
            {t('prompts.filter.all')}
          </button>
          <button
            type="button"
            className={`category-chip ${category === 'favorites' ? 'active' : ''}`}
            onClick={() => setCategory('favorites')}
          >
            <Star size={12} /> {t('prompts.filter.favorites')}
          </button>
          <button
            type="button"
            className={`category-chip ${category === 'mine' ? 'active' : ''}`}
            onClick={() => setCategory('mine')}
          >
            {t('prompts.filter.mine')}
          </button>
          {PROMPT_CATEGORY_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              className={`category-chip ${category === id ? 'active' : ''}`}
              onClick={() => setCategory(id)}
            >
              {categoryLabel(id)}
            </button>
          ))}
        </div>

        <div className="prompt-lib-body">
          <div className="prompt-lib-list">
            {items.length === 0 ? (
              <div className="prompt-lib-empty">
                <Layers size={20} />
                <p>{t('prompts.empty')}</p>
              </div>
            ) : (
              items.map((item) => {
                const id = item.data.id;
                const active = preview?.data.id === id;
                return (
                  <div
                    key={id}
                    role="button"
                    tabIndex={0}
                    className={`prompt-lib-item ${active ? 'active' : ''}`}
                    onClick={() => setPreviewId(id)}
                    onDoubleClick={() => applyItem(item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setPreviewId(id);
                      }
                    }}
                  >
                    <div className="prompt-lib-item-top">
                      <span className="prompt-lib-item-title">{getTitle(item)}</span>
                      <button
                        type="button"
                        className={`prompt-fav ${isFavorite(id) ? 'on' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(id);
                        }}
                        title={t('prompts.favorite')}
                        aria-label={t('prompts.favorite')}
                      >
                        <Star size={13} fill={isFavorite(id) ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                    <div className="prompt-lib-item-meta mono">
                      {item.kind === 'builtin'
                        ? categoryLabel(item.data.category)
                        : categoryLabel(
                            item.data.category === 'custom'
                              ? 'custom'
                              : item.data.category,
                          )}
                      {item.kind === 'builtin' ? ` · ${t('prompts.builtin')}` : ` · ${t('prompts.saved')}`}
                    </div>
                    <p className="prompt-lib-item-snip">{getBody(item)}</p>
                  </div>
                );
              })
            )}
          </div>

          <aside className="prompt-lib-preview">
            {preview ? (
              <>
                <div className="prompt-lib-preview-head">
                  <h3>{getTitle(preview)}</h3>
                  <span className="badge mono">
                    {preview.kind === 'builtin'
                      ? categoryLabel(preview.data.category)
                      : t('prompts.saved')}
                  </span>
                </div>
                <pre className="prompt-lib-preview-body">{getBody(preview)}</pre>
                <div className="prompt-lib-preview-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => applyItem(preview)}
                  >
                    <CornerDownLeft size={14} />
                    {applyMode === 'replace'
                      ? t('prompts.use.replace')
                      : t('prompts.use.append')}
                  </button>
                  {preview.kind === 'user' && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        removeUserPrompt(preview.data.id);
                        setPreviewId(null);
                      }}
                    >
                      <Trash2 size={14} /> {t('common.delete')}
                    </button>
                  )}
                </div>
                <p className="prompt-lib-hint mono">{t('prompts.hint.dblclick')}</p>
              </>
            ) : (
              <div className="prompt-lib-empty">
                <p>{t('prompts.preview.empty')}</p>
              </div>
            )}
          </aside>
        </div>

        <footer className="prompt-lib-footer">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={saveCurrent}
            disabled={!currentPrompt.trim()}
          >
            <Plus size={14} /> {t('prompts.saveCurrent')}
          </button>
          <span className="prompt-lib-shortcut mono">{t('prompts.shortcut')}</span>
        </footer>
      </div>
    </div>
  );
}
