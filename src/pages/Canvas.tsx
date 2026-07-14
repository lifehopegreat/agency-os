import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type OnConnect,
  type Viewport,
  Panel,
  SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  LayoutGrid,
  Focus,
  ImagePlus,
  Wand2,
  Clapperboard,
  Trash2,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AssetNodeView, { type AssetFlowNode } from './canvas/AssetNodeView';
import GenerationNodeView, {
  type GenerationFlowNode,
} from './canvas/GenerationNodeView';
import { CanvasRuntimeProvider } from './canvas/canvasRuntime';
import AssetDetailDrawer from '../components/AssetDetailDrawer';
import { generateSeed, useGeneration } from '../state/GenerationContext';
import { usePreferences } from '../state/PreferencesContext';
import { useProviders } from '../state/ProvidersContext';
import { useI18n } from '../i18n/useI18n';
import { loadCanvas, saveCanvas } from '../state/canvasStorage';
import type {
  CanvasAssetNodeData,
  CanvasGenerationNodeData,
  ReferenceRole,
} from '../state/canvasTypes';
import { referenceCapabilities, referenceModeForInputs } from '../lib/modelCapabilities';
import { recipeFromAsset, type CreateLocationState } from '../lib/recipe';

export type CanvasLocationState = {
  addAssetId?: string;
  addPrompt?: string;
};

type FlowNode = AssetFlowNode | GenerationFlowNode;
type CanvasPoint = { x: number; y: number };

const nodeTypes = {
  asset: AssetNodeView,
  generation: GenerationNodeView,
};

function makeNodeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

const MAX_DROPPED_MEDIA_BYTES = 20 * 1024 * 1024;

function fileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Unable to read dropped media.'));
    reader.onerror = () => reject(new Error('Unable to read dropped media.'));
    reader.readAsDataURL(file);
  });
}

function defaultGenData(
  type: 'image' | 'video',
  modelKey: string,
): CanvasGenerationNodeData {
  return {
    kind: 'generation',
    type,
    modelKey,
    prompt: '',
    ratio: '16:9',
    quality: 'high',
    duration: 4,
    seed: '',
    status: 'idle',
    referenceNodeIds: [],
    referenceRoles: {},
  };
}

function CanvasInner() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { library, startGeneration, status, pushToast, removeAsset, importLocalAsset } = useGeneration();
  const { defaultImageModelKey, defaultVideoModelKey } = usePreferences();
  const { selectableModels, providers } = useProviders();
  const { fitView, getViewport, setViewport, screenToFlowPosition } = useReactFlow();

  const initial = useMemo(() => loadCanvas(), []);
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<FlowNode>(
    (initial.nodes as FlowNode[]) ?? [],
  );
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>(initial.edges ?? []);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<CanvasPoint | null>(null);
  const [contextMenu, setContextMenu] = useState<(CanvasPoint & { target: CanvasPoint }) | null>(null);
  const runningNodeId = useRef<string | null>(null);
  const persistTimer = useRef<number | null>(null);
  const lastImportKey = useRef('');
  const fileDragDepth = useRef(0);
  const [fileDragActive, setFileDragActive] = useState(false);

  /** Strip removed asset node ids from generation reference queues */
  const pruneRefsForRemovedNodes = useCallback(
    (removedIds: Set<string>) => {
      if (!removedIds.size) return;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type !== 'generation') return n;
          const d = n.data as CanvasGenerationNodeData;
          const referenceNodeIds = d.referenceNodeIds.filter((id) => !removedIds.has(id));
          if (referenceNodeIds.length === d.referenceNodeIds.length) return n;
          const referenceRoles = { ...d.referenceRoles };
          for (const k of Object.keys(referenceRoles)) {
            if (!referenceNodeIds.includes(k)) delete referenceRoles[k];
          }
          return { ...n, data: { ...d, referenceNodeIds, referenceRoles } };
        }),
      );
    },
    [setNodes],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      const removed = new Set(
        changes
          .filter((c): c is NodeChange<FlowNode> & { type: 'remove'; id: string } => c.type === 'remove')
          .map((c) => c.id),
      );
      onNodesChangeBase(changes);
      if (removed.size) {
        setEdges((eds) =>
          eds.filter((e) => !removed.has(e.source) && !removed.has(e.target)),
        );
        pruneRefsForRemovedNodes(removed);
      }
    },
    [onNodesChangeBase, setEdges, pruneRefsForRemovedNodes],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      const removedEdgeIds = new Set(
        changes.filter((c) => c.type === 'remove').map((c) => c.id),
      );
      if (removedEdgeIds.size) {
        const removedEdges = edges.filter((e) => removedEdgeIds.has(e.id));
        if (removedEdges.length) {
          setNodes((nds) =>
            nds.map((n) => {
              if (n.type !== 'generation') return n;
              const d = n.data as CanvasGenerationNodeData;
              const drop = new Set(
                removedEdges
                  .filter((e) => e.target === n.id)
                  .map((e) => e.source),
              );
              if (!drop.size) return n;
              const referenceNodeIds = d.referenceNodeIds.filter((id) => !drop.has(id));
              const referenceRoles = { ...d.referenceRoles };
              for (const k of drop) delete referenceRoles[k];
              return { ...n, data: { ...d, referenceNodeIds, referenceRoles } };
            }),
          );
        }
      }
      onEdgesChangeBase(changes);
    },
    [edges, onEdgesChangeBase, setNodes],
  );

  const assetsById = useMemo(
    () => new Map(library.map((a) => [a.id, a])),
    [library],
  );

  const imageModels = useMemo(
    () => selectableModels.filter((m) => !m.kind || m.kind === 'image'),
    [selectableModels],
  );
  const videoModels = useMemo(
    () => selectableModels.filter((m) => !m.kind || m.kind === 'video'),
    [selectableModels],
  );
  const defaultModelFor = useCallback((type: 'image' | 'video') => {
    const pool = type === 'video' ? videoModels : imageModels;
    const preferredKey = type === 'video' ? defaultVideoModelKey : defaultImageModelKey;
    return pool.find((model) => model.key === preferredKey) ?? pool[0] ?? null;
  }, [imageModels, videoModels, defaultImageModelKey, defaultVideoModelKey]);

  // Drop orphan asset nodes when library asset deleted
  useEffect(() => {
    setNodes((nds) => {
      const next = nds.filter((n) => {
        if (n.type !== 'asset') return true;
        return assetsById.has((n.data as CanvasAssetNodeData).assetId);
      });
      if (next.length === nds.length) return nds;
      const valid = new Set(next.map((n) => n.id));
      setEdges((eds) =>
        eds.filter((e) => valid.has(e.source) && valid.has(e.target)),
      );
      return next.map((n) => {
        if (n.type !== 'generation') return n;
        const d = n.data as CanvasGenerationNodeData;
        const referenceNodeIds = d.referenceNodeIds.filter((id) => valid.has(id));
        if (referenceNodeIds.length === d.referenceNodeIds.length) return n;
        const referenceRoles = { ...d.referenceRoles };
        for (const k of Object.keys(referenceRoles)) {
          if (!referenceNodeIds.includes(k)) delete referenceRoles[k];
        }
        return { ...n, data: { ...d, referenceNodeIds, referenceRoles } };
      });
    });
  }, [assetsById, setNodes, setEdges]);

  // Persist
  useEffect(() => {
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      const vp = getViewport();
      const savedNodes = nodes.filter((n) =>
        n.type !== 'asset' || !assetsById.get((n.data as CanvasAssetNodeData).assetId)?.localOnly,
      );
      const savedIds = new Set(savedNodes.map((n) => n.id));
      saveCanvas({
        nodes: savedNodes.map((n) => ({
          id: n.id,
          type: (n.type ?? 'asset') as 'asset' | 'generation',
          position: n.position,
          data: n.data as CanvasAssetNodeData | CanvasGenerationNodeData,
        })),
        edges: edges.filter((e) => savedIds.has(e.source) && savedIds.has(e.target)).map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          data: e.data as { role?: ReferenceRole; order?: number } | undefined,
        })),
        viewport: { x: vp.x, y: vp.y, zoom: vp.zoom },
      });
    }, 400);
    return () => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, [nodes, edges, assetsById, getViewport]);

  useEffect(() => {
    if (initial.viewport) setViewport(initial.viewport as Viewport);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateGenNode = useCallback(
    (id: string, patch: Partial<CanvasGenerationNodeData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id && n.type === 'generation'
            ? { ...n, data: { ...(n.data as CanvasGenerationNodeData), ...patch } }
            : n,
        ),
      );
    },
    [setNodes],
  );

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      const source = nodes.find((n) => n.id === connection.source);
      const target = nodes.find((n) => n.id === connection.target);
      if (!source || !target) return false;
      if (source.type !== 'asset' || target.type !== 'generation') return false;
      if (
        edges.some(
          (e) => e.source === connection.source && e.target === connection.target,
        )
      ) {
        return false;
      }
      const gen = target.data as CanvasGenerationNodeData;
      const assetNode = source.data as CanvasAssetNodeData;
      const asset = assetsById.get(assetNode.assetId);
      if (!asset) return false;
      const currentRefs = gen.referenceNodeIds
        .map((nid) => {
          const an = nodes.find((x) => x.id === nid);
          if (!an || an.type !== 'asset') return null;
          const currentAsset = assetsById.get((an.data as CanvasAssetNodeData).assetId);
          return currentAsset
            ? { kind: currentAsset.type as 'image' | 'video', firstFrame: gen.referenceRoles[nid] === 'first-frame' }
            : null;
        })
        .filter(Boolean);
      const hasFirstFrame = currentRefs.some((ref) => ref!.firstFrame);
      const nextFirstFrame = gen.type === 'video' && asset.type === 'image' && !hasFirstFrame;
      const candidateRefs = [
        ...currentRefs,
        { kind: asset.type as 'image' | 'video', firstFrame: nextFirstFrame },
      ] as Array<{ kind: 'image' | 'video'; firstFrame?: boolean }>;
      const mode = referenceModeForInputs(gen.type, candidateRefs);
      const model = selectableModels.find((m) => m.key === gen.modelKey);
      const caps = referenceCapabilities(model?.modelId, gen.type, mode);
      const imgN = candidateRefs.filter((ref) => ref.kind === 'image').length;
      const vidN = candidateRefs.filter((ref) => ref.kind === 'video').length;
      if (asset.type === 'image' && imgN > caps.imageLimit) return false;
      if (asset.type === 'video' && vidN > caps.videoLimit) return false;
      return true;
    },
    [nodes, edges, assetsById, selectableModels],
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (!isValidConnection(connection)) {
        pushToast({ tone: 'error', title: t('canvas.connect.rejected') });
        return;
      }
      const source = nodes.find((n) => n.id === connection.source);
      const target = nodes.find((n) => n.id === connection.target);
      const gen = target?.data as CanvasGenerationNodeData | undefined;
      const assetNode = source?.data as CanvasAssetNodeData | undefined;
      const asset = assetNode ? assetsById.get(assetNode.assetId) : undefined;

      // Smart default roles: first image into video gen → first-frame
      let defaultRole: ReferenceRole = 'reference';
      if (gen?.type === 'video' && asset?.type === 'image') {
        const alreadyHasFirstFrame = gen.referenceNodeIds.some(
          (nid) => gen.referenceRoles[nid] === 'first-frame',
        );
        defaultRole = alreadyHasFirstFrame ? 'style' : 'first-frame';
      } else if (asset?.type === 'image' && gen?.referenceNodeIds.length === 0) {
        defaultRole = 'subject';
      }

      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: makeNodeId('e'),
            style: { stroke: 'rgba(204,255,0,0.45)' },
            data: { role: defaultRole },
          },
          eds,
        ),
      );
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== connection.target || n.type !== 'generation') return n;
          const d = n.data as CanvasGenerationNodeData;
          if (d.referenceNodeIds.includes(connection.source!)) return n;
          return {
            ...n,
            data: {
              ...d,
              referenceNodeIds: [...d.referenceNodeIds, connection.source!],
              referenceRoles: {
                ...d.referenceRoles,
                [connection.source!]: defaultRole,
              },
            },
          };
        }),
      );
    },
    [isValidConnection, nodes, assetsById, setEdges, setNodes, pushToast, t],
  );

  const addAssetNode = useCallback(
    (assetId: string, opts?: { silent?: boolean; promptSeed?: string; position?: CanvasPoint }) => {
      const asset = assetsById.get(assetId);
      if (!asset) return null;
      // Avoid duplicate nodes for same asset when importing from nav
      const existing = nodes.find(
        (n) =>
          n.type === 'asset' &&
          (n.data as CanvasAssetNodeData).assetId === assetId,
      );
      if (existing) {
        if (!opts?.silent) {
          pushToast({ tone: 'info', title: t('canvas.toast.assetAdded'), body: asset.id });
        }
        return existing.id;
      }
      const id = makeNodeId('a');
      const offset = nodes.length * 24;
      setNodes((nds) => [
        ...nds,
        {
          id,
          type: 'asset',
          position: opts?.position ?? { x: 80 + offset, y: 80 + (offset % 200) },
          data: { kind: 'asset', assetId },
        } as AssetFlowNode,
      ]);
      setPickerOpen(false);
      setPickerTarget(null);
      if (!opts?.silent) {
        pushToast({ tone: 'info', title: t('canvas.toast.assetAdded'), body: asset.id });
      }
      return id;
    },
    [assetsById, nodes, setNodes, pushToast, t],
  );

  // Import asset / prompt from Assets / Reverse via navigation state
  useEffect(() => {
    const state = (location.state ?? null) as CanvasLocationState | null;
    if (!state?.addAssetId && !state?.addPrompt) return;
    const importKey = `${state.addAssetId ?? ''}::${state.addPrompt ?? ''}`;
    if (lastImportKey.current === importKey) return;
    lastImportKey.current = importKey;

    let assetNodeId: string | null = null;
    if (state.addAssetId && assetsById.has(state.addAssetId)) {
      assetNodeId = addAssetNode(state.addAssetId, { silent: true });
    }

    if (state.addPrompt?.trim() || assetNodeId) {
      const model = defaultModelFor('image') ?? selectableModels[0] ?? null;
      if (model) {
        const gid = makeNodeId('g');
        const genData = defaultGenData('image', model.key);
        if (state.addPrompt?.trim()) genData.prompt = state.addPrompt.trim().slice(0, 2000);
        if (assetNodeId) {
          genData.referenceNodeIds = [assetNodeId];
          genData.referenceRoles = { [assetNodeId]: 'subject' };
        }
        setNodes((nds) => {
          const assetN = assetNodeId ? nds.find((n) => n.id === assetNodeId) : undefined;
          const baseX = assetN ? assetN.position.x + 300 : 420;
          const baseY = assetN ? assetN.position.y : 120;
          return [
            ...nds,
            {
              id: gid,
              type: 'generation',
              position: { x: baseX, y: baseY },
              data: genData,
            } as GenerationFlowNode,
          ];
        });
        if (assetNodeId) {
          setEdges((eds) => [
            ...eds,
            {
              id: makeNodeId('e'),
              source: assetNodeId!,
              target: gid,
              style: { stroke: 'rgba(204,255,0,0.45)' },
              data: { role: 'subject' as ReferenceRole },
            },
          ]);
        }
        pushToast({
          tone: 'info',
          title: t('canvas.toast.imported'),
        });
      } else if (assetNodeId) {
        pushToast({ tone: 'info', title: t('canvas.toast.assetAdded') });
      }
    }

    navigate(location.pathname, { replace: true, state: {} });
  }, [
    location.state,
    location.pathname,
    assetsById,
    addAssetNode,
    imageModels,
    selectableModels,
    defaultModelFor,
    setNodes,
    setEdges,
    navigate,
    pushToast,
    t,
  ]);

  const addGenerationNode = useCallback(
    (type: 'image' | 'video', position?: CanvasPoint) => {
      const model = defaultModelFor(type);
      if (!model) {
        pushToast({ tone: 'error', title: t('canvas.toast.noModel') });
        return;
      }
      const id = makeNodeId('g');
      const offset = nodes.length * 28;
      setNodes((nds) => [
        ...nds,
        {
          id,
          type: 'generation',
          position: position ?? { x: 420 + offset, y: 120 + (offset % 160) },
          data: defaultGenData(type, model.key),
        } as GenerationFlowNode,
      ]);
    },
    [defaultModelFor, nodes.length, setNodes, pushToast, t],
  );

  const openCanvasMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault();
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(event.clientX - bounds.left, bounds.width - 190);
    const y = Math.min(event.clientY - bounds.top, bounds.height - 280);
    setPickerOpen(false);
    setPickerTarget(null);
    setContextMenu({
      x: Math.max(8, x),
      y: Math.max(8, y),
      target: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
    });
  }, [screenToFlowPosition]);

  useEffect(() => {
    const closeMenu = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
        setPickerOpen(false);
      }
    };
    window.addEventListener('keydown', closeMenu);
    return () => window.removeEventListener('keydown', closeMenu);
  }, []);

  const onCanvasDragEnter = useCallback((event: React.DragEvent) => {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    event.preventDefault();
    fileDragDepth.current += 1;
    setFileDragActive(true);
  }, []);

  const onCanvasDragOver = useCallback((event: React.DragEvent) => {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onCanvasDragLeave = useCallback((event: React.DragEvent) => {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    event.preventDefault();
    fileDragDepth.current -= 1;
    if (fileDragDepth.current <= 0) {
      fileDragDepth.current = 0;
      setFileDragActive(false);
    }
  }, []);

  const onCanvasDrop = useCallback((event: React.DragEvent) => {
    const droppedFiles = Array.from(event.dataTransfer.files);
    if (!droppedFiles.length) return;
    event.preventDefault();
    fileDragDepth.current = 0;
    setFileDragActive(false);
    const files = droppedFiles.filter((file) =>
      file.type.startsWith('image/') || file.type.startsWith('video/'),
    );
    if (!files.length) {
      pushToast({ tone: 'error', title: t('canvas.drop.unsupported') });
      return;
    }

    const accepted = files.filter((file) => file.size <= MAX_DROPPED_MEDIA_BYTES);
    if (!accepted.length) {
      pushToast({ tone: 'error', title: t('canvas.drop.tooLarge') });
      return;
    }
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    void Promise.all(accepted.map(async (file) =>
      importLocalAsset({
        name: file.name,
        type: file.type.startsWith('video/') ? 'video' : 'image',
        url: await fileAsDataUrl(file),
      }),
    )).then((assets) => {
      setNodes((nds) => [
        ...nds,
        ...assets.map((asset, index) => ({
          id: makeNodeId('a'),
          type: 'asset' as const,
          position: { x: position.x + index * 28, y: position.y + index * 28 },
          data: { kind: 'asset' as const, assetId: asset.id },
        })),
      ]);
      pushToast({ tone: 'success', title: t('canvas.drop.imported', { n: assets.length }) });
    }).catch((error) => {
      pushToast({ tone: 'error', title: error instanceof Error ? error.message : t('canvas.drop.failed') });
    });
  }, [importLocalAsset, pushToast, screenToFlowPosition, setNodes, t]);

  const deleteSelected = useCallback(() => {
    setNodes((nds) => {
      const remove = new Set(nds.filter((n) => n.selected).map((n) => n.id));
      setEdges((eds) =>
        eds.filter((e) => !remove.has(e.source) && !remove.has(e.target)),
      );
      return nds.filter((n) => !n.selected);
    });
  }, [setNodes, setEdges]);

  const autoLayout = useCallback(() => {
    setNodes((nds) => {
      const assets = nds.filter((n) => n.type === 'asset');
      const gens = nds.filter((n) => n.type === 'generation');
      const next: FlowNode[] = [];
      assets.forEach((n, i) => {
        next.push({ ...n, position: { x: 60, y: 60 + i * 200 } });
      });
      gens.forEach((n, i) => {
        next.push({ ...n, position: { x: 380, y: 40 + i * 360 } });
      });
      nds.forEach((n) => {
        if (!next.find((x) => x.id === n.id)) next.push(n);
      });
      return next;
    });
    window.setTimeout(() => fitView({ padding: 0.2 }), 50);
  }, [setNodes, fitView]);

  const reorderRef = useCallback(
    (nodeId: string, from: number, to: number) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId || n.type !== 'generation') return n;
          const d = n.data as CanvasGenerationNodeData;
          const arr = [...d.referenceNodeIds];
          if (to < 0 || to >= arr.length) return n;
          const [item] = arr.splice(from, 1);
          arr.splice(to, 0, item);
          return { ...n, data: { ...d, referenceNodeIds: arr } };
        }),
      );
    },
    [setNodes],
  );

  const removeRef = useCallback(
    (nodeId: string, assetNodeId: string) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId || n.type !== 'generation') return n;
          const d = n.data as CanvasGenerationNodeData;
          const roles = { ...d.referenceRoles };
          delete roles[assetNodeId];
          return {
            ...n,
            data: {
              ...d,
              referenceNodeIds: d.referenceNodeIds.filter((x) => x !== assetNodeId),
              referenceRoles: roles,
            },
          };
        }),
      );
      setEdges((eds) =>
        eds.filter((e) => !(e.source === assetNodeId && e.target === nodeId)),
      );
    },
    [setNodes, setEdges],
  );

  const roleChange = useCallback(
    (nodeId: string, assetNodeId: string, role: ReferenceRole) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId || n.type !== 'generation') return n;
          const d = n.data as CanvasGenerationNodeData;
          return {
            ...n,
            data: {
              ...d,
              referenceRoles: { ...d.referenceRoles, [assetNodeId]: role },
            },
          };
        }),
      );
    },
    [setNodes],
  );

  const runGeneration = useCallback(
    async (nodeId: string) => {
      if (status === 'queued' || status === 'running') {
        updateGenNode(nodeId, {
          status: 'waiting',
          lastError: t('canvas.warn.busy'),
        });
        pushToast({ tone: 'info', title: t('canvas.toast.busy') });
        return;
      }
      const node = nodes.find((n) => n.id === nodeId);
      if (!node || node.type !== 'generation') return;
      const d = node.data as CanvasGenerationNodeData;
      const model = selectableModels.find((m) => m.key === d.modelKey);
      if (!model) {
        updateGenNode(nodeId, {
          status: 'failed',
          lastError: t('canvas.toast.noModel'),
        });
        return;
      }
      if (!d.prompt.trim()) {
        updateGenNode(nodeId, {
          status: 'failed',
          lastError: t('canvas.warn.prompt'),
        });
        return;
      }

      const provider = providers.find((p) => p.id === model.providerId);
      const refsWithNodeId = d.referenceNodeIds
        .map((nid) => {
          const an = nodes.find((x) => x.id === nid);
          if (!an || an.type !== 'asset') return null;
          const asset = assetsById.get((an.data as CanvasAssetNodeData).assetId);
          if (!asset?.url) return null;
          return { nodeId: nid, kind: asset.type as 'image' | 'video', url: asset.url };
        })
        .filter(Boolean) as Array<{ nodeId: string; kind: 'image' | 'video'; url: string }>;
      const refs = refsWithNodeId.map(({ kind, url }) => ({ kind, url }));
      const referenceMode = referenceModeForInputs(
        d.type,
        refsWithNodeId.map((ref) => ({
          kind: ref.kind,
          firstFrame: d.referenceRoles[ref.nodeId] === 'first-frame',
        })),
      );
      const caps = referenceCapabilities(model.modelId, d.type, referenceMode);
      const imageCount = refs.filter((reference) => reference.kind === 'image').length;
      const videoCount = refs.filter((reference) => reference.kind === 'video').length;
      if (imageCount > caps.imageLimit || videoCount > caps.videoLimit) {
        updateGenNode(nodeId, {
          status: 'failed',
          lastError: t('canvas.warn.referenceMode'),
        });
        return;
      }

      runningNodeId.current = nodeId;
      const seed = d.seed.trim() || generateSeed();
      updateGenNode(nodeId, { status: 'running', lastError: undefined, seed });

      try {
        const result = await startGeneration({
          prompt: d.prompt.trim(),
          type: d.type,
          model: `${model.providerName} / ${model.label}`,
          ratio: d.ratio,
          quality: d.quality,
          seed,
          duration: d.type === 'video' ? d.duration : undefined,
          references: refs,
          referenceMode,
          provider: provider
            ? {
                baseUrl: provider.baseUrl,
                apiKey: provider.apiKey,
                modelId: model.modelId,
              }
            : undefined,
        });

        updateGenNode(nodeId, {
          status: 'success',
          lastJobId: result.jobId,
          lastError: undefined,
          seed: result.seed,
        });

        const rid = makeNodeId('a');
        setNodes((nds) => {
          const gen = nds.find((n) => n.id === nodeId);
          const pos = gen
            ? { x: gen.position.x + 340, y: gen.position.y + 40 }
            : { x: 700, y: 100 };
          return [
            ...nds,
            {
              id: rid,
              type: 'asset',
              position: pos,
              data: { kind: 'asset', assetId: result.assetId },
            } as AssetFlowNode,
          ];
        });
        setEdges((eds) => [
          ...eds,
          {
            id: makeNodeId('e'),
            source: nodeId,
            target: rid,
            style: { stroke: 'rgba(52,211,153,0.65)' },
            animated: true,
          },
        ]);
      } catch (err) {
        updateGenNode(nodeId, {
          status: 'failed',
          lastError: err instanceof Error ? err.message : t('canvas.gen.failed'),
        });
      } finally {
        runningNodeId.current = null;
      }
    },
    [
      status,
      nodes,
      selectableModels,
      providers,
      assetsById,
      startGeneration,
      updateGenNode,
      setNodes,
      setEdges,
      pushToast,
      t,
    ],
  );

  const runtimeValue = useMemo(
    () => ({
      library,
      nodes,
      imageModels,
      videoModels,
      allModels: selectableModels,
      busy: status === 'running' || status === 'queued',
      onOpenDetail: setDetailId,
      onChangeGen: updateGenNode,
      onRun: runGeneration,
      onReorderRef: reorderRef,
      onRemoveRef: removeRef,
      onRoleChange: roleChange,
    }),
    [
      library,
      nodes,
      imageModels,
      videoModels,
      selectableModels,
      status,
      updateGenNode,
      runGeneration,
      reorderRef,
      removeRef,
      roleChange,
    ],
  );

  const detailAsset = detailId ? library.find((a) => a.id === detailId) ?? null : null;
  const nodeChecks = useMemo(
    () =>
      nodes
        .filter((n) => n.type === 'generation')
        .map((n) => {
          const data = n.data as CanvasGenerationNodeData;
          const model = selectableModels.find((m) => m.key === data.modelKey);
          const refs = data.referenceNodeIds
            .map((id) => nodes.find((node) => node.id === id))
            .filter((node): node is AssetFlowNode => node?.type === 'asset')
            .map((node) => {
              const asset = assetsById.get((node.data as CanvasAssetNodeData).assetId);
              return asset
                ? { kind: asset.type as 'image' | 'video', firstFrame: data.referenceRoles[node.id] === 'first-frame' }
                : null;
            })
            .filter(Boolean) as Array<{ kind: 'image' | 'video'; firstFrame?: boolean }>;
          const mode = referenceModeForInputs(data.type, refs);
          const caps = referenceCapabilities(model?.modelId, data.type, mode);
          const imageCount = refs.filter((asset) => asset.kind === 'image').length;
          const videoCount = refs.filter((asset) => asset.kind === 'video').length;
          const hasPrompt = Boolean(data.prompt.trim());
          const refsValid = imageCount <= caps.imageLimit && videoCount <= caps.videoLimit;
          return {
            hasPrompt,
            refsValid,
            runnable:
              data.status === 'idle' &&
              hasPrompt &&
              Boolean(model) &&
              refsValid &&
              status !== 'queued' &&
              status !== 'running',
          };
        }),
    [nodes, selectableModels, assetsById, status],
  );
  const genCount = nodeChecks.length;
  const runnable = nodeChecks.filter((check) => check.runnable).length;
  const missingPrompt = nodeChecks.filter((check) => !check.hasPrompt).length;
  const referenceBlocked = nodeChecks.filter((check) => !check.refsValid).length;
  const waiting = nodes.filter(
    (n) =>
      n.type === 'generation' &&
      ((n.data as CanvasGenerationNodeData).status === 'waiting' ||
        (n.data as CanvasGenerationNodeData).status === 'running'),
  ).length;

  return (
    <CanvasRuntimeProvider value={runtimeValue}>
      <div className="canvas-page">
        <header className="page-header canvas-page-header">
          <div className="page-header-text">
            <div className="page-kicker">{t('canvas.kicker')}</div>
            <h1 className="page-title">{t('canvas.title')}</h1>
            <p className="page-desc">{t('canvas.desc')}</p>
          </div>
        </header>

        <div
          className={`canvas-shell ${fileDragActive ? 'is-file-dragging' : ''}`}
          onDragEnter={onCanvasDragEnter}
          onDragOver={onCanvasDragOver}
          onDragLeave={onCanvasDragLeave}
          onDrop={onCanvasDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onPaneContextMenu={openCanvasMenu}
            onPaneClick={() => {
              setContextMenu(null);
              setPickerOpen(false);
              setPickerTarget(null);
            }}
            isValidConnection={isValidConnection}
            nodeTypes={nodeTypes}
            fitView
            selectionMode={SelectionMode.Partial}
            multiSelectionKeyCode="Shift"
            deleteKeyCode={['Backspace', 'Delete']}
            minZoom={0.25}
            maxZoom={1.75}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={18} size={1} color="rgba(255,255,255,0.04)" />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              maskColor="rgba(0,0,0,0.55)"
              nodeColor={(n) =>
                n.type === 'generation'
                  ? 'rgba(204,255,0,0.45)'
                  : 'rgba(59,158,255,0.45)'
              }
            />
            <Panel position="top-right" className="canvas-inspect card">
              <div className="canvas-inspect-title mono">{t('canvas.inspect')}</div>
              <div className="canvas-inspect-row">
                <span>{t('canvas.inspect.runnable')}</span>
                <strong className="mono">{runnable}</strong>
              </div>
              <div className="canvas-inspect-row">
                <span>{t('canvas.inspect.waiting')}</span>
                <strong className="mono">{waiting}</strong>
              </div>
              <div className="canvas-inspect-row">
                <span>{t('canvas.inspect.gens')}</span>
                <strong className="mono">{genCount}</strong>
              </div>
              {missingPrompt > 0 && (
                <div className="canvas-inspect-row">
                  <span>{t('canvas.inspect.promptMissing')}</span>
                  <strong className="mono">{missingPrompt}</strong>
                </div>
              )}
              {referenceBlocked > 0 && (
                <div className="canvas-inspect-row">
                  <span>{t('canvas.inspect.referenceBlocked')}</span>
                  <strong className="mono">{referenceBlocked}</strong>
                </div>
              )}
              {selectableModels.length === 0 && (
                <p className="form-field-hint">
                  {t('canvas.toast.noModel')}{' '}
                  <Link to="/providers" className="text-link">
                    {t('app.nav.providers')}
                  </Link>
                </p>
              )}
            </Panel>
          </ReactFlow>

          {contextMenu && (
            <div
              className="canvas-context-menu card"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              role="menu"
              aria-label={t('canvas.title')}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setPickerTarget(contextMenu.target);
                  setPickerOpen(true);
                  setContextMenu(null);
                }}
              >
                <ImagePlus size={14} /> {t('canvas.addAsset')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  addGenerationNode('image', contextMenu.target);
                  setContextMenu(null);
                }}
              >
                <Wand2 size={14} /> {t('canvas.addImageGen')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  addGenerationNode('video', contextMenu.target);
                  setContextMenu(null);
                }}
              >
                <Clapperboard size={14} /> {t('canvas.addVideoGen')}
              </button>
              <div className="canvas-context-divider" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  autoLayout();
                  setContextMenu(null);
                }}
              >
                <LayoutGrid size={14} /> {t('canvas.autoLayout')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  fitView({ padding: 0.2 });
                  setContextMenu(null);
                }}
              >
                <Focus size={14} /> {t('canvas.fit')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  deleteSelected();
                  setContextMenu(null);
                }}
              >
                <Trash2 size={14} /> {t('canvas.delete')}
              </button>
            </div>
          )}

          {fileDragActive && (
            <div className="canvas-drop-overlay" aria-hidden>
              <strong>{t('canvas.drop.hint')}</strong>
              <span>{t('canvas.drop.session')}</span>
            </div>
          )}

          {pickerOpen && (
            <div className="canvas-picker card">
              <div className="canvas-picker-head">
                <strong>{t('canvas.picker.title')}</strong>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setPickerOpen(false);
                    setPickerTarget(null);
                  }}
                >
                  ×
                </button>
              </div>
              {library.length === 0 ? (
                <p className="form-field-hint">{t('canvas.picker.empty')}</p>
              ) : (
                <div className="canvas-picker-grid">
                  {library.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="canvas-picker-item"
                      onClick={() => addAssetNode(a.id, { position: pickerTarget ?? undefined })}
                    >
                      <div
                        className="canvas-picker-thumb"
                        style={{ '--asset-hue': String(a.hue) } as React.CSSProperties}
                      >
                        {a.url ? (
                          a.type === 'video' ? (
                            <video src={a.url} muted />
                          ) : (
                            <img src={a.url} alt="" />
                          )
                        ) : (
                          <div className="asset-art" />
                        )}
                      </div>
                      <span className="mono">{a.id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <AssetDetailDrawer
          asset={detailAsset}
          categoryLabel="—"
          onClose={() => setDetailId(null)}
          onReuse={(asset) => {
            const state: CreateLocationState = {
              reuse: recipeFromAsset(asset),
              reuseFrom: asset.id,
            };
            navigate('/', { state });
          }}
          onCopyImage={async (asset) => {
            if (!asset.url) {
              pushToast({ tone: 'error', title: t('canvas.asset.missing') });
              return;
            }
            try {
              await navigator.clipboard.writeText(
                asset.url.startsWith('http')
                  ? asset.url
                  : new URL(asset.url, window.location.origin).href,
              );
              pushToast({ tone: 'info', title: t('reverse.toast.copied') });
            } catch {
              pushToast({ tone: 'error', title: t('reverse.toast.copyFail') });
            }
          }}
          onUseAsReference={(asset) => {
            addAssetNode(asset.id);
            setDetailId(null);
          }}
          onDelete={(id) => {
            removeAsset(id);
            setDetailId(null);
          }}
        />
      </div>
    </CanvasRuntimeProvider>
  );
}

export default function CanvasPage() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
