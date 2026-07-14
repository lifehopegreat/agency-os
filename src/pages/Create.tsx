import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { animate, stagger } from 'animejs';
import {
  Image as ImageIcon,
  Video,
  Upload,
  Play,
  Sliders,
  CheckCircle2,
  ExternalLink,
  Dices,
  Loader2,
  BookMarked,
  RefreshCw,
  Cpu,
  X,
  GripVertical,
} from 'lucide-react';
import { generateSeed, useGeneration } from '../state/GenerationContext';
import { usePreferences } from '../state/PreferencesContext';
import { useProviders } from '../state/ProvidersContext';
import { useI18n } from '../i18n/useI18n';
import PromptLibrary, { type ApplyPromptPayload } from '../components/PromptLibrary';
import type { CreateLocationState } from '../lib/recipe';
import {
  outputSpecs,
  referenceCapabilities,
  videoDurationOptions,
  seedSupported,
  type ReferenceMode,
} from '../lib/modelCapabilities';

type ReferenceItem = {
  name: string;
  kind: 'image' | 'video';
  file?: File;
  url?: string;
  previewUrl?: string;
};

function fileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Unable to read reference file.'));
    reader.onerror = () => reject(new Error('Unable to read reference file.'));
    reader.readAsDataURL(file);
  });
}

const CreatePage = () => {
  const { startGeneration, status, job, lastCompletedId, progress, pushToast } =
    useGeneration();
  const { openQueueOnSubmit, defaultImageModelKey, defaultVideoModelKey } = usePreferences();
  const { selectableModels, findSelectable, providers } = useProviders();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const [type, setType] = useState<'image' | 'video'>('image');
  const [modelKey, setModelKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState('16:9');
  const [quality, setQuality] = useState('high');
  const [duration, setDuration] = useState(4);
  const [seed, setSeed] = useState('');
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [referenceMode, setReferenceMode] = useState<ReferenceMode>('image-reference');
  const [dragReferenceIndex, setDragReferenceIndex] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [reuseBanner, setReuseBanner] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const localPreviewUrls = useRef(new Set<string>());
  const containerRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const isBusy = status === 'queued' || status === 'running';
  const outputModels = selectableModels.filter((m) => !m.kind || m.kind === type);
  const hasModels = outputModels.length > 0;
  const selected =
    outputModels.find((m) => m.key === modelKey) ?? outputModels[0] ?? null;
  const specs = outputSpecs(selected?.modelId, type);
  const referenceCapability = referenceCapabilities(selected?.modelId, type, referenceMode);
  const durationOptions = type === 'video' ? videoDurationOptions(selected?.modelId) : null;
  const allowsVideoMode = referenceCapability.videoModes?.includes(referenceMode);
  const referenceKind: 'image' | 'video' = referenceMode === 'video-edit' ? 'video' : 'image';
  const referenceLimit = referenceKind === 'video'
    ? referenceCapability.videoLimit
    : referenceCapability.imageLimit;
  const referenceLimitLabel = referenceCapability.imageLimitKind === 'project'
    ? '项目上限'
    : referenceCapability.imageLimitKind === 'recommended'
      ? '建议最多'
      : '最多';
  const referencesSupported = referenceLimit > 0 && (type === 'image' || allowsVideoMode);
  const selectedSpec = specs.find((spec) => spec.value === quality) ?? specs[0];
  const supportsSeed = seedSupported(selected?.modelId, type);
  const estCost = selected
    ? (type === 'video' ? selected.cost * 3.5 : selected.cost) *
      (quality === 'high' ? 1.25 : 1)
    : 0;
  const showResult =
    (status === 'success' && job) || (status === 'idle' && lastCompletedId);
  const referenceCount = references.length;

  // Keep model selection valid when providers change
  useEffect(() => {
    if (!hasModels) {
      setModelKey('');
      return;
    }
    if (!outputModels.some((m) => m.key === modelKey)) {
      const preferredKey = type === 'image' ? defaultImageModelKey : defaultVideoModelKey;
      setModelKey(outputModels.find((m) => m.key === preferredKey)?.key ?? outputModels[0].key);
    }
  }, [outputModels, hasModels, modelKey, type, defaultImageModelKey, defaultVideoModelKey]);

  useEffect(() => {
    if (!specs.some((spec) => spec.value === quality)) setQuality(specs[0].value);
  }, [specs, quality]);

  useEffect(() => {
    if (durationOptions && !durationOptions.includes(duration)) setDuration(6);
  }, [durationOptions, duration]);

  // Apply reuse payload from Assets (or elsewhere)
  useEffect(() => {
    const state = location.state as CreateLocationState | null;
    if (!state?.reuse && !state?.reference && !state?.references?.length) return;

    if (state.reuse) {
      const r = state.reuse;
      setPrompt(r.prompt.slice(0, 2000));
      setType(r.type === 'video' ? 'video' : 'image');
      const matched = findSelectable(r.model);
      if (matched) setModelKey(matched.key);
      const ratioNorm = (r.ratio || '16:9').replace('/', ':');
      if (ratioNorm === '1:1' || ratioNorm === '16:9' || ratioNorm === '9:16') {
        setRatio(ratioNorm);
      }
      if (r.quality === 'standard' || r.quality === 'high') {
        setQuality(r.quality);
      }
      if (typeof r.duration === 'number' && r.duration >= 1 && r.duration <= 10) {
        setDuration(r.duration);
      }
      setSeed(r.seed ?? '');
      setReuseBanner(state.reuseFrom ?? t('create.reuse.banner'));
      pushToast({
        tone: 'info',
        title: t('create.reuse.toast'),
        body: state.reuseFrom,
      });
    }
    const incomingReferences = state.references ?? (state.reference ? [state.reference] : []);
    if (incomingReferences.length) {
      setReferences(incomingReferences.map((reference): ReferenceItem => ({
        name: reference.name,
        url: reference.url,
        kind: 'kind' in reference && reference.kind === 'video' ? 'video' : 'image',
      })));
      pushToast({ tone: 'info', title: t('create.reference.loaded') });
    }

    navigate(location.pathname, { replace: true, state: null });
    window.setTimeout(() => promptRef.current?.focus(), 0);
  }, [location.state, location.pathname, navigate, pushToast, t, findSelectable]);

  useEffect(() => {
    if (type === 'video' && referenceCapability.videoModes?.length && !referenceCapability.videoModes.includes(referenceMode)) {
      setReferenceMode(referenceCapability.videoModes[0]);
    }
  }, [type, referenceCapability.videoModes, referenceMode]);

  useEffect(() => {
    if (!referencesSupported) {
      setReferences([]);
      return;
    }
    setReferences((current) => current
      .filter((reference) => reference.kind === referenceKind)
      .slice(0, referenceLimit));
  }, [referencesSupported, referenceKind, referenceLimit]);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (containerRef.current && !prefersReduced) {
      animate(containerRef.current.querySelectorAll('.stagger-item'), {
        translateY: [12, 0],
        opacity: [0, 1],
        duration: 360,
        delay: stagger(70),
        ease: 'outCubic',
      });
    }
  }, []);

  useEffect(() => () => {
    localPreviewUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const handleGenerate = useCallback(() => {
    if (!prompt.trim() || isBusy || !selected) return;
    void (async () => {
      let resolvedReferences: Array<{ kind: 'image' | 'video'; url: string }>;
      try {
        resolvedReferences = await Promise.all(references.map(async (reference) => ({
          kind: reference.kind,
          url: reference.url
            ? new URL(reference.url, window.location.origin).href
            : await fileAsDataUrl(reference.file as File),
        })));
      } catch (error) {
        pushToast({ tone: 'error', title: error instanceof Error ? error.message : 'Reference import failed.' });
        return;
      }
      try {
        const resolvedSeed = seed.trim() || generateSeed();
        setSeed(resolvedSeed);
        await startGeneration({
          prompt: prompt.trim(),
          type,
          model: `${selected.providerName} / ${selected.label}`,
          ratio,
          quality,
          seed: resolvedSeed,
          duration: type === 'video' ? duration : undefined,
          references: resolvedReferences,
          referenceMode: type === 'video' ? referenceMode : undefined,
          provider: {
            baseUrl: providers.find((p) => p.id === selected.providerId)?.baseUrl ?? '',
            apiKey: providers.find((p) => p.id === selected.providerId)?.apiKey ?? '',
            modelId: selected.modelId,
          },
        });
        if (openQueueOnSubmit) navigate('/queue');
      } catch { /* GenerationContext already reports request errors. */ }
    })();
  }, [
    prompt,
    isBusy,
    startGeneration,
    type,
    selected,
    ratio,
    quality,
    seed,
    duration,
    references,
    referenceMode,
    openQueueOnSubmit,
    navigate,
    providers,
    pushToast,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleGenerate();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setLibraryOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleGenerate]);

  const applyFromLibrary = useCallback((payload: ApplyPromptPayload) => {
    setPrompt((prev) => {
      if (payload.mode === 'append' && prev.trim()) {
        return `${prev.trim()}\n\n${payload.body}`.slice(0, 2000);
      }
      return payload.body.slice(0, 2000);
    });
    if (payload.ratio) setRatio(payload.ratio);
    window.setTimeout(() => promptRef.current?.focus(), 0);
  }, []);

  const addFiles = (files: Iterable<File>) => {
    if (!referencesSupported) return;
    const supported = Array.from(files).filter((file) => file.type.startsWith(`${referenceKind}/`));
    if (!supported.length) {
      pushToast({ tone: 'error', title: referenceKind === 'video' ? '请上传视频参考素材。' : '请上传图片参考素材。' });
      return;
    }
    const additions = supported.slice(0, Math.max(0, referenceLimit - references.length)).map((file) => {
      const previewUrl = URL.createObjectURL(file);
      localPreviewUrls.current.add(previewUrl);
      return { name: file.name, file, kind: referenceKind, previewUrl };
    });
    setReferences((current) => [...current, ...additions].slice(0, referenceLimit));
  };

  const removeReference = (index: number) => {
    setReferences((current) => {
      const removed = current[index];
      if (removed?.previewUrl && localPreviewUrls.current.delete(removed.previewUrl)) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const moveReference = (from: number, to: number) => {
    if (from === to) return;
    setReferences((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handlePromptPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const item = Array.from(event.clipboardData.items).find(
      (candidate) => candidate.kind === 'file' && candidate.type.startsWith('image/'),
    );
    const image = item?.getAsFile() ?? Array.from(event.clipboardData.files).find(
      (candidate) => candidate.type.startsWith('image/'),
    );
    if (!image || !referencesSupported || referenceKind !== 'image') return;

    event.preventDefault();
    const extension = image.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
    addFiles([new File([image], `clipboard-image-${Date.now()}.${extension}`, { type: image.type })]);
  };

  return (
    <div className="create-page" ref={containerRef}>
      <header className="page-header stagger-item">
        <div className="page-header-text">
          <div className="page-kicker">{t('create.kicker')}</div>
          <h1 className="page-title">{t('create.title')}</h1>
          <p className="page-desc">{t('create.desc')}</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setLibraryOpen(true)}
          title={t('create.promptLibrary.hint')}
        >
          <BookMarked size={14} />
          {t('create.promptLibrary')}
          <span className="btn-kbd mono">{t('create.promptLibrary.hint')}</span>
        </button>
      </header>

      {reuseBanner && (
        <div className="reuse-banner stagger-item" role="status">
          <RefreshCw size={15} />
          <span>
            {t('create.reuse.applied')}
            {reuseBanner ? ` · ${reuseBanner}` : ''}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setReuseBanner(null)}
          >
            {t('common.dismiss')}
          </button>
        </div>
      )}

      {!hasModels && (
        <div className="provider-missing-banner stagger-item" role="status">
          <Cpu size={16} />
          <div className="provider-missing-text">
            <strong>{t('create.noProvider.title')}</strong>
            <span>
              {providers.length === 0
                ? t('create.noProvider.desc')
                : t('create.noProvider.disconnected')}
            </span>
          </div>
          <Link to="/providers" className="btn btn-primary btn-sm">
            {t('create.noProvider.cta')}
          </Link>
        </div>
      )}

      <div
        className="type-selector stagger-item"
        role="tablist"
        aria-label={t('create.outputType')}
      >
        <button
          type="button"
          role="tab"
          aria-selected={type === 'image'}
          className={`type-btn ${type === 'image' ? 'active' : ''}`}
          onClick={() => setType('image')}
        >
          <ImageIcon size={16} /> {t('common.image')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={type === 'video'}
          className={`type-btn ${type === 'video' ? 'active' : ''}`}
          onClick={() => setType('video')}
        >
          <Video size={16} /> {t('common.video')}
        </button>
      </div>

      <div className="create-layout">
        <div className="create-main stagger-item">
          <div className="card">
            <div className="form-group">
              <label htmlFor="prompt">
                <span className="prompt-label-row">
                  {t('create.prompt')}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm prompt-lib-inline-btn"
                    onClick={() => setLibraryOpen(true)}
                  >
                    <BookMarked size={13} />
                    {t('create.promptLibrary')}
                  </button>
                </span>
                <span className="mono tabular">{prompt.length} / 2000</span>
              </label>
              <textarea
                id="prompt"
                ref={promptRef}
                rows={7}
                maxLength={2000}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onPaste={handlePromptPaste}
                placeholder={t('create.prompt.placeholder')}
              />
            </div>

            <div className="form-group form-group-last">
              <label>
                {t('create.ref')} <span className="form-hint">{t('common.optional')}</span>
              </label>
              {type === 'video' && referenceCapability.videoModes && (
                <select
                  className="reference-mode-select"
                  aria-label="参考素材模式"
                  value={referenceMode}
                  onChange={(event) => setReferenceMode(event.target.value as ReferenceMode)}
                >
                  {referenceCapability.videoModes.includes('image-reference') && (
                    <option value="image-reference">
                      参考图（{referenceLimitLabel} {referenceCapability.imageLimit} 张）
                    </option>
                  )}
                  {referenceCapability.videoModes.includes('image-to-video') && (
                    <option value="image-to-video">首帧图转视频（1 张）</option>
                  )}
                  {referenceCapability.videoModes.includes('video-edit') && (
                    <option value="video-edit">参考视频编辑（1 个）</option>
                  )}
                </select>
              )}
              {referencesSupported ? (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept={referenceKind === 'video' ? 'video/*' : 'image/*'}
                    multiple={referenceLimit > 1}
                    className="sr-only"
                    onChange={(event) => {
                      if (event.target.files) addFiles(event.target.files);
                      event.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    className={`upload-zone ${referenceCount ? 'has-file' : ''} ${dragging ? 'is-dragging' : ''}`}
                    onClick={() => fileRef.current?.click()}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragging(false);
                      addFiles(event.dataTransfer.files);
                    }}
                  >
                    <Upload size={22} strokeWidth={1.5} />
                    <span className="upload-zone-title">
                      {referenceCount ? `已添加 ${referenceCount} / ${referenceLimit} 个参考素材` : t('create.upload')}
                    </span>
                    <span className="upload-zone-sub">
                      {referenceKind === 'video'
                        ? 'MP4 视频参考 · 最多 20MB'
                        : `PNG / JPG / WEBP · ${referenceLimitLabel} ${referenceLimit} 张，每张最大 20MB · 也可在提示词框粘贴图片`}
                    </span>
                  </button>
                  {referenceCount > 0 && (
                    <div className="reference-list" aria-label="已添加的参考素材">
                      <p className="reference-list-hint"><GripVertical size={13} /> 拖动缩略图调整参考顺序</p>
                      {references.map((reference, index) => (
                        <div
                          className={`reference-item ${dragReferenceIndex === index ? 'is-dragging' : ''}`}
                          key={`${reference.name}-${index}`}
                          draggable
                          onDragStart={() => setDragReferenceIndex(index)}
                          onDragEnd={() => setDragReferenceIndex(null)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (dragReferenceIndex !== null) moveReference(dragReferenceIndex, index);
                            setDragReferenceIndex(null);
                          }}
                        >
                          <GripVertical className="reference-grip" size={16} aria-hidden="true" />
                          <div className="reference-thumb" aria-hidden="true">
                            {reference.kind === 'image' ? (
                              <img src={reference.previewUrl ?? reference.url} alt="" />
                            ) : (
                              <video src={reference.previewUrl ?? reference.url} muted preload="metadata" />
                            )}
                          </div>
                          <span>参考{index + 1} · {reference.name}</span>
                          {reference.url && <span className="reference-item-source">资产</span>}
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon reference-remove"
                            aria-label={`移除参考${index + 1}`}
                            onClick={() => removeReference(index)}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="form-field-hint">当前模型未声明参考素材能力；切换至支持的模型后可上传。</p>
              )}
            </div>
          </div>

          {isBusy && (
            <div className="result-slot busy" role="status">
              <div className="result-slot-meta">
                <div className="inline-center">
                  <Loader2 size={16} className="spin" />
                  <span className="result-slot-title">
                    {status === 'queued'
                      ? t('create.busy.queued')
                      : t('create.busy.rendering')}
                  </span>
                </div>
                <span className="result-slot-id mono">
                  {job?.id} · {Math.round(progress)}%
                </span>
              </div>
              <div className="mini-progress" aria-hidden>
                <div className="mini-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {showResult && !isBusy && (
            <div className="result-slot success" role="status">
              <div className="result-slot-meta">
                <div className="inline-center">
                  <CheckCircle2 size={16} color="var(--status-success)" />
                  <span className="result-slot-title">{t('create.done.title')}</span>
                </div>
                <span className="result-slot-id">
                  {t('create.done.meta', { id: job?.id ?? lastCompletedId ?? '' })}
                </span>
              </div>
              <div className="inline-actions">
                <Link to="/queue" className="btn btn-secondary btn-sm">
                  {t('create.openQueue')}
                </Link>
                <Link to="/assets" className="btn btn-primary btn-sm">
                  <ExternalLink size={14} /> {t('create.openAssets')}
                </Link>
              </div>
            </div>
          )}
        </div>

        <aside className="create-aside stagger-item">
          <div className="card params-card">
            <div className="card-header">
              <Sliders size={15} /> {t('create.params')}
            </div>

            <div className="form-group">
              <label htmlFor="model">{t('create.model')}</label>
              <select
                id="model"
                value={modelKey}
                onChange={(e) => setModelKey(e.target.value)}
                disabled={!hasModels}
              >
                {!hasModels ? (
                  <option value="">{t('create.model.empty')}</option>
                ) : (
                  outputModels.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.providerName} · {m.label}
                    </option>
                  ))
                )}
              </select>
              {selected && (
                <p className="form-field-hint mono">
                  {selected.modelId} · {selected.providerName}
                </p>
              )}
            </div>

              <div className="form-grid form-grid-tight">
              <div className="form-group">
                <label htmlFor="ratio">{t('create.aspect')}</label>
                <select id="ratio" value={ratio} onChange={(e) => setRatio(e.target.value)}>
                  <option value="1:1">1:1</option>
                  <option value="16:9">16:9</option>
                  <option value="9:16">9:16</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="quality">输出规格</label>
                <select
                  id="quality"
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                >
                  {specs.map((spec) => (
                    <option key={spec.value} value={spec.value}>{spec.label}</option>
                  ))}
                </select>
                {selectedSpec && <p className="form-field-hint mono">{selectedSpec.detail}</p>}
              </div>
            </div>

            {type === 'video' && (
              <div className="form-group">
                <label htmlFor="duration">
                  {t('create.duration')}
                  <span className="mono tabular">{duration}s</span>
                </label>
                {durationOptions ? (
                  <select
                    id="duration"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  >
                    {durationOptions.map((seconds) => <option key={seconds} value={seconds}>{seconds}s</option>)}
                  </select>
                ) : (
                  <input
                    id="duration"
                    type="range"
                    min={1}
                    max={10}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="range-input"
                  />
                )}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="seed">{t('create.seed')}</label>
              <div className="input-row">
                <input
                  id="seed"
                  type="number"
                  placeholder={t('common.random')}
                  className="mono"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-icon"
                  title={t('create.seed.randomize')}
                  onClick={() => setSeed(generateSeed())}
                >
                  <Dices size={15} />
                </button>
              </div>
              <p className="form-field-hint">
                {supportsSeed ? t('create.seed.supported') : t('create.seed.tracking')}
              </p>
            </div>

            <div className="params-footer">
              <div className="cost-row">
                <span>{t('create.cost')}</span>
                <span className="tabular">~ ${estCost.toFixed(2)}</span>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={handleGenerate}
                disabled={isBusy || !prompt.trim() || !selected}
              >
                {isBusy ? (
                  <>
                    <Loader2 size={16} className="spin" /> {t('create.generating')}
                  </>
                ) : (
                  <>
                    <Play size={16} fill="currentColor" /> {t('create.generate')}
                  </>
                )}
              </button>
              <p className="generate-hint">{t('create.shortcut')}</p>
            </div>
          </div>
        </aside>
      </div>

      <PromptLibrary
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onApply={applyFromLibrary}
        currentPrompt={prompt}
      />
    </div>
  );
};

export default CreatePage;
