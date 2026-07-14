import React, { createContext, useContext } from 'react';
import type { LibraryAsset } from '../../state/GenerationContext';
import type { SelectableModel } from '../../state/ProvidersContext';
import type { CanvasGenerationNodeData, ReferenceRole } from '../../state/canvasTypes';
import type { Node } from '@xyflow/react';

type CanvasRuntimeValue = {
  library: LibraryAsset[];
  nodes: Node[];
  imageModels: SelectableModel[];
  videoModels: SelectableModel[];
  allModels: SelectableModel[];
  busy: boolean;
  onOpenDetail: (assetId: string) => void;
  onChangeGen: (id: string, patch: Partial<CanvasGenerationNodeData>) => void;
  onRun: (id: string) => void;
  onReorderRef: (id: string, from: number, to: number) => void;
  onRemoveRef: (id: string, assetNodeId: string) => void;
  onRoleChange: (id: string, assetNodeId: string, role: ReferenceRole) => void;
};

const CanvasRuntimeContext = createContext<CanvasRuntimeValue | null>(null);

export function CanvasRuntimeProvider({
  value,
  children,
}: {
  value: CanvasRuntimeValue;
  children: React.ReactNode;
}) {
  return (
    <CanvasRuntimeContext.Provider value={value}>{children}</CanvasRuntimeContext.Provider>
  );
}

export function useCanvasRuntime() {
  const ctx = useContext(CanvasRuntimeContext);
  if (!ctx) throw new Error('useCanvasRuntime outside provider');
  return ctx;
}
