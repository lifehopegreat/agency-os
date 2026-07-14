import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type ProviderModel = {
  id: string;
  label: string;
  kind?: 'image' | 'video' | 'vision';
  cost?: number;
};

export function inferModelKind(modelId: string): ProviderModel['kind'] | undefined {
  if (/video|sora|veo|kling|runway|wan|hunyuan|omni.*video/i.test(modelId)) return 'video';
  if (/image|dall|imagine|nano\s*banana|imagen/i.test(modelId)) return 'image';
  if (/vision|vlm|gpt-(?:4o|4\.1|5)|grok-(?!imagine)|gemini-(?:2|3)|claude/i.test(modelId)) return 'vision';
  return undefined;
}

export type Provider = {
  id: string;
  name: string;
  baseUrl: string;
  /** Stored only in localStorage for later API wiring */
  apiKey: string;
  status: 'connected' | 'disconnected';
  models: ProviderModel[];
  createdAt: number;
};

export type SelectableModel = {
  key: string;
  providerId: string;
  providerName: string;
  modelId: string;
  kind?: ProviderModel['kind'];
  label: string;
  cost: number;
  disabled?: boolean;
};

type ProvidersContextValue = {
  providers: Provider[];
  selectableModels: SelectableModel[];
  addProvider: (input: {
    name: string;
    baseUrl: string;
    apiKey: string;
    modelsText: string;
    status?: Provider['status'];
  }) => Provider | null;
  updateProvider: (
    id: string,
    patch: Partial<Pick<Provider, 'name' | 'baseUrl' | 'apiKey' | 'status' | 'models'>>,
  ) => void;
  removeProvider: (id: string) => void;
  setProviderStatus: (id: string, status: Provider['status']) => void;
  findSelectable: (keyOrLabel: string) => SelectableModel | undefined;
};

const STORAGE_KEY = 'agency_os_providers_v1';

const ProvidersContext = createContext<ProvidersContextValue | null>(null);

function makeId() {
  return `prv_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4).toString(36)}`;
}

/** Parse "dall-e-3, grok-vision" or "dall-e-3|OpenAI DALL·E 3" */
export function parseModelsText(text: string): ProviderModel[] {
  const parts = text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: ProviderModel[] = [];
  for (const part of parts) {
    const [idRaw, labelRaw, kindRaw] = part.split('|').map((s) => s.trim());
    // Provider model IDs are opaque: some gateways use display IDs with spaces.
    const id = (idRaw || '').trim();
    const dedupeKey = id.toLowerCase();
    if (!id || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({
      id,
      label: labelRaw || idRaw || id,
      kind: kindRaw === 'image' || kindRaw === 'video' || kindRaw === 'vision'
        ? kindRaw
        : inferModelKind(idRaw),
    });
  }
  return out;
}

export function modelsToText(models: ProviderModel[]): string {
  return models.map((m) => m.kind ? `${m.id}|${m.label}|${m.kind}` : m.label !== m.id ? `${m.id}|${m.label}` : m.id).join(', ');
}

function loadProviders(): Provider[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((p): Provider | null => {
        if (!p || typeof p !== 'object') return null;
        const o = p as Record<string, unknown>;
        if (typeof o.id !== 'string' || typeof o.name !== 'string') return null;
        const models = Array.isArray(o.models)
          ? o.models
              .map((m): ProviderModel | null => {
                if (!m || typeof m !== 'object') return null;
                const mm = m as Record<string, unknown>;
                if (typeof mm.id !== 'string') return null;
                return {
                  id: mm.id,
                  label: typeof mm.label === 'string' ? mm.label : mm.id,
                  kind: mm.kind === 'image' || mm.kind === 'video' || mm.kind === 'vision'
                    ? mm.kind
                    : undefined,
                  cost: typeof mm.cost === 'number' ? mm.cost : undefined,
                };
              })
              .filter((m): m is ProviderModel => m !== null)
          : [];
        return {
          id: o.id,
          name: o.name,
          baseUrl: typeof o.baseUrl === 'string' ? o.baseUrl : '',
          apiKey: typeof o.apiKey === 'string' ? o.apiKey : '',
          status: o.status === 'disconnected' ? 'disconnected' : 'connected',
          models,
          createdAt: typeof o.createdAt === 'number' ? o.createdAt : Date.now(),
        };
      })
      .filter((p): p is Provider => p !== null);
  } catch {
    return [];
  }
}

export function ProvidersProvider({ children }: { children: React.ReactNode }) {
  const [providers, setProviders] = useState<Provider[]>(() =>
    typeof window === 'undefined' ? [] : loadProviders(),
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(providers));
    } catch {
      /* ignore */
    }
  }, [providers]);

  const addProvider = useCallback(
    (input: {
      name: string;
      baseUrl: string;
      apiKey: string;
      modelsText: string;
      status?: Provider['status'];
    }) => {
      const name = input.name.trim();
      const baseUrl = input.baseUrl.trim();
      if (!name || !baseUrl) return null;
      const models = parseModelsText(input.modelsText);
      const next: Provider = {
        id: makeId(),
        name,
        baseUrl,
        apiKey: input.apiKey,
        status: input.status ?? 'connected',
        models,
        createdAt: Date.now(),
      };
      setProviders((list) => [next, ...list]);
      return next;
    },
    [],
  );

  const updateProvider = useCallback(
    (
      id: string,
      patch: Partial<Pick<Provider, 'name' | 'baseUrl' | 'apiKey' | 'status' | 'models'>>,
    ) => {
      setProviders((list) =>
        list.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      );
    },
    [],
  );

  const removeProvider = useCallback((id: string) => {
    setProviders((list) => list.filter((p) => p.id !== id));
  }, []);

  const setProviderStatus = useCallback((id: string, status: Provider['status']) => {
    setProviders((list) => list.map((p) => (p.id === id ? { ...p, status } : p)));
  }, []);

  const selectableModels = useMemo<SelectableModel[]>(() => {
    const out: SelectableModel[] = [];
    for (const p of providers) {
      if (p.status !== 'connected') continue;
      for (const m of p.models) {
        out.push({
          key: `${p.id}::${m.id}`,
          providerId: p.id,
          providerName: p.name,
          modelId: m.id,
          kind: m.kind,
          label: m.label,
          cost: typeof m.cost === 'number' ? m.cost : 0.04,
        });
      }
    }
    return out;
  }, [providers]);

  const findSelectable = useCallback(
    (keyOrLabel: string) => {
      return (
        selectableModels.find((m) => m.key === keyOrLabel) ||
        selectableModels.find((m) => m.modelId === keyOrLabel) ||
        selectableModels.find((m) => m.label === keyOrLabel) ||
        selectableModels.find(
          (m) =>
            `${m.providerName} / ${m.label}` === keyOrLabel ||
            keyOrLabel.includes(m.label) ||
            keyOrLabel.includes(m.modelId),
        )
      );
    },
    [selectableModels],
  );

  const value = useMemo(
    () => ({
      providers,
      selectableModels,
      addProvider,
      updateProvider,
      removeProvider,
      setProviderStatus,
      findSelectable,
    }),
    [
      providers,
      selectableModels,
      addProvider,
      updateProvider,
      removeProvider,
      setProviderStatus,
      findSelectable,
    ],
  );

  return (
    <ProvidersContext.Provider value={value}>{children}</ProvidersContext.Provider>
  );
}

export function useProviders() {
  const ctx = useContext(ProvidersContext);
  if (!ctx) throw new Error('useProviders must be used within ProvidersProvider');
  return ctx;
}
