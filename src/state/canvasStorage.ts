import type { PersistedCanvas } from './canvasTypes';

export const CANVAS_STORAGE_KEY = 'agency_os_canvas_v1';

const empty: PersistedCanvas = {
  version: 1,
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 0.85 },
  savedAt: 0,
};

export function loadCanvas(): PersistedCanvas {
  try {
    const raw = localStorage.getItem(CANVAS_STORAGE_KEY);
    if (!raw) return { ...empty };
    const parsed = JSON.parse(raw) as PersistedCanvas;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.nodes)) {
      return { ...empty };
    }
    return {
      version: 1,
      nodes: parsed.nodes,
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
      viewport: parsed.viewport ?? empty.viewport,
      savedAt: parsed.savedAt ?? 0,
    };
  } catch {
    return { ...empty };
  }
}

export function saveCanvas(data: Omit<PersistedCanvas, 'version' | 'savedAt'>): void {
  try {
    const payload: PersistedCanvas = {
      version: 1,
      nodes: data.nodes,
      edges: data.edges,
      viewport: data.viewport,
      savedAt: Date.now(),
    };
    localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}
