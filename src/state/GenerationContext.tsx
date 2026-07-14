import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { tt } from '../i18n/runtime';
import { loadGenerationState, saveGenerationState } from './generationStorage';

export type GenStatus = 'idle' | 'queued' | 'running' | 'success' | 'failed';

export type GenJob = {
  id: string;
  prompt: string;
  type: 'image' | 'video';
  model: string;
  status: GenStatus;
  startedAt: number;
  ratio?: string;
  quality?: string;
  seed?: string;
  duration?: number;
};

/** Snapshot for one-click reuse on Create. */
export type AssetRecipe = {
  prompt: string;
  type: 'image' | 'video';
  model: string;
  ratio: string;
  quality?: string;
  seed?: string;
  duration?: number;
};

export type LibraryAsset = {
  id: string;
  jobId: string;
  type: 'image' | 'video';
  model: string;
  prompt: string;
  dim: string;
  ratio: '1/1' | '16/9' | '9/16';
  createdAt: number;
  hue: number;
  /** null / missing = uncategorized */
  categoryId: string | null;
  /** Local generated file or provider-hosted image URL. */
  url?: string;
  /** Generation parameters for reuse (optional for older persisted assets). */
  recipe?: AssetRecipe;
  /** Browser-dropped file kept only for the current session. */
  localOnly?: boolean;
};

/** Generates a saved request seed even when an upstream model cannot honor it. */
export function generateSeed(): string {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return String(value[0]);
}

export type AssetCategory = {
  id: string;
  name: string;
  createdAt: number;
};

export type ToastMessage = {
  id: string;
  tone: 'success' | 'info' | 'error';
  title: string;
  body?: string;
};

type StartPayload = {
  prompt: string;
  type: 'image' | 'video';
  model: string;
  ratio?: string;
  quality?: string;
  seed?: string;
  duration?: number;
  references?: Array<{ kind: 'image' | 'video'; url: string }>;
  referenceMode?: 'image-reference' | 'image-to-video' | 'video-edit';
  provider?: { baseUrl: string; apiKey: string; modelId: string };
};

export type SessionJob = GenJob & {
  finishedAt?: number;
};

type GenerationContextValue = {
  job: GenJob | null;
  status: GenStatus;
  progress: number;
  lastCompletedId: string | null;
  library: LibraryAsset[];
  categories: AssetCategory[];
  /** User-submitted jobs; persisted across reloads. */
  sessionJobs: SessionJob[];
  toast: ToastMessage | null;
  startGeneration: (payload: StartPayload) => Promise<{ jobId: string; assetId: string; seed: string }>;
  importLocalAsset: (input: { name: string; type: 'image' | 'video'; url: string }) => LibraryAsset;
  removeAsset: (id: string) => void;
  updateAssetDimensions: (id: string, width: number, height: number) => void;
  setAssetCategory: (assetId: string, categoryId: string | null) => void;
  addCategory: (name: string) => AssetCategory | null;
  renameCategory: (id: string, name: string) => boolean;
  removeCategory: (id: string) => void;
  reset: () => void;
  dismissToast: () => void;
  pushToast: (t: Omit<ToastMessage, 'id'>) => void;
};

const GenerationContext = createContext<GenerationContextValue | null>(null);

function makeId(prefix: string) {
  const n = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .toUpperCase()
    .padStart(6, '0');
  return `${prefix}-${n}`;
}

function ratioToDim(ratio: string, type: 'image' | 'video'): {
  dim: string;
  ratioKey: '1/1' | '16/9' | '9/16';
} {
  if (ratio === '9:16') {
    return {
      dim: type === 'video' ? '1080×1920' : '832×1216',
      ratioKey: '9/16',
    };
  }
  if (ratio === '1:1') {
    return { dim: '1024×1024', ratioKey: '1/1' };
  }
  return {
    dim: type === 'video' ? '1920×1080' : '1344×768',
    ratioKey: '16/9',
  };
}

let cueContext: AudioContext | null = null;

function getCueContext() {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!cueContext || cueContext.state === 'closed') cueContext = new Ctx();
  return cueContext;
}

export async function playCue() {
  try {
    const ctx = getCueContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') await ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 880;
    g.gain.value = 0.03;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    o.stop(ctx.currentTime + 0.2);
  } catch {
    /* ignore */
  }
}

export function GenerationProvider({
  children,
  onSuccess,
}: {
  children: React.ReactNode;
  onSuccess?: (job: GenJob) => void;
}) {
  const initial = useMemo(() => loadGenerationState(), []);

  const [job, setJob] = useState<GenJob | null>(null);
  const [lastCompletedId, setLastCompletedId] = useState<string | null>(
    () => initial.lastCompletedId,
  );
  const [library, setLibrary] = useState<LibraryAsset[]>(() => initial.library);
  const [categories, setCategories] = useState<AssetCategory[]>(
    () => initial.categories,
  );
  const [sessionJobs, setSessionJobs] = useState<SessionJob[]>(
    () => initial.sessionJobs,
  );
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [progress, setProgress] = useState(0);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const persistReady = useRef(false);

  // Persist durable workspace data (not live job timers / toast)
  useEffect(() => {
    // Skip the very first paint write only if identical — still fine to write immediately
    // after hydration so quotas are exercised early.
    if (!persistReady.current) {
      persistReady.current = true;
    }
    saveGenerationState({
      library,
      categories,
      sessionJobs,
      lastCompletedId,
    });
  }, [library, categories, sessionJobs, lastCompletedId]);

  const dismissToast = useCallback(() => setToast(null), []);

  const pushToast = useCallback((t: Omit<ToastMessage, 'id'>) => {
    const id = makeId('T');
    setToast({ ...t, id });
  }, []);

  const removeAsset = useCallback((id: string) => {
    setLibrary((lib) => lib.filter((a) => a.id !== id));
  }, []);

  const importLocalAsset = useCallback((input: { name: string; type: 'image' | 'video'; url: string }) => {
    const asset: LibraryAsset = {
      id: makeId('LOCAL'),
      jobId: 'LOCAL',
      type: input.type,
      model: 'Local upload',
      prompt: input.name,
      dim: 'Local media',
      ratio: '1/1',
      createdAt: Date.now(),
      hue: Math.floor(Math.random() * 360),
      categoryId: null,
      url: input.url,
      localOnly: true,
    };
    setLibrary((lib) => [asset, ...lib].slice(0, 200));
    return asset;
  }, []);

  const updateAssetDimensions = useCallback((id: string, width: number, height: number) => {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return;
    const ratio = width / height;
    const ratioKey: LibraryAsset['ratio'] = ratio > 1.2 ? '16/9' : ratio < 0.83 ? '9/16' : '1/1';
    const dim = `${width}×${height}`;
    setLibrary((lib) => lib.map((asset) =>
      asset.id === id && (asset.dim !== dim || asset.ratio !== ratioKey)
        ? { ...asset, dim, ratio: ratioKey }
        : asset,
    ));
  }, []);

  const setAssetCategory = useCallback((assetId: string, categoryId: string | null) => {
    setLibrary((lib) =>
      lib.map((a) => (a.id === assetId ? { ...a, categoryId } : a)),
    );
  }, []);

  const addCategory = useCallback((name: string): AssetCategory | null => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const created: AssetCategory = {
      id: makeId('CAT'),
      name: trimmed,
      createdAt: Date.now(),
    };
    let accepted = false;
    setCategories((list) => {
      if (list.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
        return list;
      }
      accepted = true;
      return [...list, created];
    });
    return accepted ? created : null;
  }, []);

  const renameCategory = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    let ok = false;
    setCategories((list) => {
      if (list.some((c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase())) {
        return list;
      }
      ok = list.some((c) => c.id === id);
      return list.map((c) => (c.id === id ? { ...c, name: trimmed } : c));
    });
    return ok;
  }, []);

  const removeCategory = useCallback((id: string) => {
    setCategories((list) => list.filter((c) => c.id !== id));
    setLibrary((lib) =>
      lib.map((a) => (a.categoryId === id ? { ...a, categoryId: null } : a)),
    );
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const reset = useCallback(() => {
    setJob((current) => {
      if (current && (current.status === 'queued' || current.status === 'running')) {
        setSessionJobs((list) => {
          const rest = list.filter((j) => j.id !== current.id);
          return [
            { ...current, status: 'failed' as const, finishedAt: Date.now() },
            ...rest,
          ];
        });
      }
      return null;
    });
    setProgress(0);
  }, []);

  const startGeneration = useCallback(
    async (payload: StartPayload) => {
      const id = makeId('REQ');
      const seed = payload.seed?.trim() || generateSeed();
      const next: GenJob = {
        id,
        prompt: payload.prompt,
        type: payload.type,
        model: payload.model,
        status: 'queued',
        startedAt: Date.now(),
        ratio: payload.ratio ?? '16:9',
        quality: payload.quality,
        seed,
        duration: payload.duration,
      };
      setJob(next);
      setSessionJobs((list) => [next, ...list.filter((j) => j.id !== id)]);
      setProgress(8);
      const running = { ...next, status: 'running' as const };
      setJob(running);
      setSessionJobs((list) => list.map((item) => (item.id === id ? running : item)));
      setProgress(32);
      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload.provider, model: payload.provider?.modelId, prompt: payload.prompt, type: payload.type, ratio: payload.ratio, quality: payload.quality, duration: payload.duration, references: payload.references, referenceMode: payload.referenceMode }),
        });
        const result = await response.json() as { url?: string; error?: string };
        if (!response.ok || !result.url) throw new Error(result.error || '生成失败。');
        const done: SessionJob = { ...running, status: 'success', finishedAt: Date.now() };
        setJob(done);
        setLastCompletedId(id);
        setProgress(100);
        setSessionJobs((list) => list.map((item) => (item.id === id ? done : item)));
        const { dim, ratioKey } = ratioToDim(running.ratio ?? '16:9', running.type);
        const assetId = makeId('AST');
        setLibrary((lib) => [{ id: assetId, jobId: id, type: running.type, model: running.model, prompt: running.prompt, dim, ratio: ratioKey, createdAt: Date.now(), hue: Math.floor(Math.random() * 360), categoryId: null, url: result.url, recipe: { prompt: running.prompt, type: running.type, model: running.model, ratio: running.ratio ?? '16:9', quality: running.quality, seed: running.seed, duration: running.duration } }, ...lib].slice(0, 200));
        pushToast({ tone: 'success', title: tt('toast.assetReady'), body: tt('toast.assetReady.body', { id, model: running.model }) });
        onSuccessRef.current?.(done);
        return { jobId: id, assetId, seed };
      } catch (error) {
        const failed: SessionJob = { ...running, status: 'failed', finishedAt: Date.now() };
        setJob(failed);
        setSessionJobs((list) => list.map((item) => (item.id === id ? failed : item)));
        setProgress(0);
        pushToast({ tone: 'error', title: error instanceof Error ? error.message : '生成失败。' });
        throw error;
      }
    },
    [pushToast],
  );

  const value = useMemo<GenerationContextValue>(
    () => ({
      job,
      status: job?.status ?? 'idle',
      progress,
      lastCompletedId,
      library,
      categories,
      sessionJobs,
      toast,
      startGeneration,
      importLocalAsset,
      removeAsset,
      updateAssetDimensions,
      setAssetCategory,
      addCategory,
      renameCategory,
      removeCategory,
      reset,
      dismissToast,
      pushToast,
    }),
    [
      job,
      progress,
      lastCompletedId,
      library,
      categories,
      sessionJobs,
      toast,
      startGeneration,
      importLocalAsset,
      removeAsset,
      updateAssetDimensions,
      setAssetCategory,
      addCategory,
      renameCategory,
      removeCategory,
      reset,
      dismissToast,
      pushToast,
    ],
  );

  return (
    <GenerationContext.Provider value={value}>{children}</GenerationContext.Provider>
  );
}

export function useGeneration() {
  const ctx = useContext(GenerationContext);
  if (!ctx) {
    throw new Error('useGeneration must be used within GenerationProvider');
  }
  return ctx;
}

/** Optional sound hook — call from a child that reads preferences */
export function useSuccessSound(enabled: boolean) {
  const { status, job } = useGeneration();
  const prev = useRef<GenStatus>('idle');

  useEffect(() => {
    if (!enabled) return;
    const unlock = () => { void getCueContext()?.resume(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [enabled]);

  useEffect(() => {
    if (enabled && prev.current !== 'success' && status === 'success' && job) {
      void playCue();
    }
    prev.current = status;
  }, [enabled, status, job]);
}
