import type {
  AssetCategory,
  AssetRecipe,
  LibraryAsset,
  SessionJob,
} from './GenerationContext';

export const GENERATION_STORAGE_KEY = 'agency_os_generation_v1';

export type PersistedGeneration = {
  version: 1;
  library: LibraryAsset[];
  categories: AssetCategory[];
  sessionJobs: SessionJob[];
  lastCompletedId: string | null;
  savedAt: number;
};

const empty: PersistedGeneration = {
  version: 1,
  library: [],
  categories: [],
  sessionJobs: [],
  lastCompletedId: null,
  savedAt: 0,
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function normalizeRecipe(raw: unknown, fallback: LibraryAsset): AssetRecipe {
  if (isRecord(raw) && typeof raw.prompt === 'string') {
    return {
      prompt: raw.prompt,
      type: raw.type === 'video' ? 'video' : 'image',
      model: typeof raw.model === 'string' ? raw.model : fallback.model,
      ratio:
        typeof raw.ratio === 'string'
          ? raw.ratio.replace('/', ':')
          : fallback.ratio.replace('/', ':'),
      quality: typeof raw.quality === 'string' ? raw.quality : undefined,
      seed: typeof raw.seed === 'string' ? raw.seed : undefined,
      duration: typeof raw.duration === 'number' ? raw.duration : undefined,
    };
  }
  // Backfill for assets saved before recipe existed
  return {
    prompt: fallback.prompt,
    type: fallback.type,
    model: fallback.model,
    ratio: fallback.ratio.replace('/', ':'),
  };
}

function normalizeAsset(raw: unknown): LibraryAsset | null {
  if (!isRecord(raw) || typeof raw.id !== 'string') return null;
  const type = raw.type === 'video' ? 'video' : raw.type === 'image' ? 'image' : null;
  if (!type) return null;
  const ratio =
    raw.ratio === '1/1' || raw.ratio === '16/9' || raw.ratio === '9/16' ? raw.ratio : '1/1';
  const base: LibraryAsset = {
    id: raw.id,
    jobId: typeof raw.jobId === 'string' ? raw.jobId : '',
    type,
    model: typeof raw.model === 'string' ? raw.model : '—',
    prompt: typeof raw.prompt === 'string' ? raw.prompt : '',
    dim: typeof raw.dim === 'string' ? raw.dim : '—',
    ratio,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    hue: typeof raw.hue === 'number' ? raw.hue : 72,
    categoryId: typeof raw.categoryId === 'string' ? raw.categoryId : null,
    url: typeof raw.url === 'string' ? raw.url : undefined,
  };
  return {
    ...base,
    recipe: normalizeRecipe(raw.recipe, base),
  };
}

function normalizeCategory(raw: unknown): AssetCategory | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string') {
    return null;
  }
  return {
    id: raw.id,
    name: raw.name,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
  };
}

const STATUSES = new Set(['idle', 'queued', 'running', 'success', 'failed']);

function normalizeJob(raw: unknown): SessionJob | null {
  if (!isRecord(raw) || typeof raw.id !== 'string') return null;
  const status =
    typeof raw.status === 'string' && STATUSES.has(raw.status)
      ? (raw.status as SessionJob['status'])
      : 'failed';
  const type = raw.type === 'video' ? 'video' : 'image';
  // In-flight jobs cannot resume timers after reload → mark terminal
  const terminal =
    status === 'queued' || status === 'running'
      ? ('failed' as const)
      : status === 'idle'
        ? ('failed' as const)
        : status;

  return {
    id: raw.id,
    prompt: typeof raw.prompt === 'string' ? raw.prompt : '',
    type,
    model: typeof raw.model === 'string' ? raw.model : '—',
    status: terminal,
    startedAt: typeof raw.startedAt === 'number' ? raw.startedAt : Date.now(),
    ratio: typeof raw.ratio === 'string' ? raw.ratio : undefined,
    quality: typeof raw.quality === 'string' ? raw.quality : undefined,
    seed: typeof raw.seed === 'string' ? raw.seed : undefined,
    duration: typeof raw.duration === 'number' ? raw.duration : undefined,
    finishedAt:
      typeof raw.finishedAt === 'number'
        ? raw.finishedAt
        : terminal === 'failed' || terminal === 'success'
          ? Date.now()
          : undefined,
  };
}

export function loadGenerationState(): PersistedGeneration {
  if (typeof window === 'undefined') return { ...empty };

  try {
    const raw = localStorage.getItem(GENERATION_STORAGE_KEY);
    if (!raw) return { ...empty };
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return { ...empty };

    const library = Array.isArray(parsed.library)
      ? parsed.library.map(normalizeAsset).filter((a): a is LibraryAsset => a !== null)
      : [];
    const categories = Array.isArray(parsed.categories)
      ? parsed.categories
          .map(normalizeCategory)
          .filter((c): c is AssetCategory => c !== null)
      : [];
    const catIds = new Set(categories.map((c) => c.id));
    // Drop orphan category refs to uncategorized
    const libraryClean = library.map((a) =>
      a.categoryId && !catIds.has(a.categoryId) ? { ...a, categoryId: null } : a,
    );
    const sessionJobs = Array.isArray(parsed.sessionJobs)
      ? parsed.sessionJobs.map(normalizeJob).filter((j): j is SessionJob => j !== null)
      : [];

    return {
      version: 1,
      library: libraryClean.slice(0, 200),
      categories: categories.slice(0, 100),
      sessionJobs: sessionJobs.slice(0, 100),
      lastCompletedId:
        typeof parsed.lastCompletedId === 'string' ? parsed.lastCompletedId : null,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
    };
  } catch {
    return { ...empty };
  }
}

export function saveGenerationState(data: {
  library: LibraryAsset[];
  categories: AssetCategory[];
  sessionJobs: SessionJob[];
  lastCompletedId: string | null;
}): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: PersistedGeneration = {
      version: 1,
      // ponytail: local Data URLs can exceed localStorage; keep drag-dropped media in-session only.
      library: data.library.filter((asset) => !asset.localOnly).slice(0, 200),
      categories: data.categories.slice(0, 100),
      sessionJobs: data.sessionJobs.slice(0, 100),
      lastCompletedId: data.lastCompletedId,
      savedAt: Date.now(),
    };
    localStorage.setItem(GENERATION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota / private mode — fail silent; UI still works in-memory
  }
}
