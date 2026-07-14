export type CanvasNodeStatus = 'idle' | 'waiting' | 'running' | 'success' | 'failed';

export type ReferenceRole =
  | 'subject'
  | 'composition'
  | 'style'
  | 'color'
  | 'first-frame'
  | 'motion'
  | 'reference';

export type CanvasAssetNodeData = {
  kind: 'asset';
  assetId: string;
};

export type CanvasGenerationNodeData = {
  kind: 'generation';
  type: 'image' | 'video';
  modelKey: string;
  prompt: string;
  ratio: string;
  quality: string;
  duration: number;
  seed: string;
  status: CanvasNodeStatus;
  lastJobId?: string;
  lastError?: string;
  /** ordered incoming asset node ids */
  referenceNodeIds: string[];
  /** role per asset node id */
  referenceRoles: Record<string, ReferenceRole>;
};

export type CanvasViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type PersistedCanvas = {
  version: 1;
  nodes: Array<{
    id: string;
    type: 'asset' | 'generation';
    position: { x: number; y: number };
    data: CanvasAssetNodeData | CanvasGenerationNodeData;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    data?: { role?: ReferenceRole; order?: number };
  }>;
  viewport: CanvasViewport;
  savedAt: number;
};
