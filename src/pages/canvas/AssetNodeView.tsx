import React, { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Film, Image as ImageIcon, ExternalLink } from 'lucide-react';
import type { CanvasAssetNodeData } from '../../state/canvasTypes';
import { useI18n } from '../../i18n/useI18n';
import { useCanvasRuntime } from './canvasRuntime';

export type AssetFlowNode = Node<CanvasAssetNodeData, 'asset'>;

function AssetNodeView({ data, selected }: NodeProps<AssetFlowNode>) {
  const { t } = useI18n();
  const { library, onOpenDetail } = useCanvasRuntime();
  const asset = library.find((a) => a.id === data.assetId);
  const missing = !asset;

  return (
    <div
      className={`canvas-node canvas-node-asset ${selected ? 'is-selected' : ''} ${missing ? 'is-missing' : ''}`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (asset) onOpenDetail(asset.id);
      }}
    >
      {/* target: accept result edges from generation nodes */}
      <Handle type="target" position={Position.Left} className="canvas-handle canvas-handle-in" />
      <Handle type="source" position={Position.Right} className="canvas-handle" />
      <div
        className="canvas-node-thumb"
        style={
          asset ? ({ '--asset-hue': String(asset.hue) } as React.CSSProperties) : undefined
        }
      >
        {asset?.url ? (
          asset.type === 'video' ? (
            <video src={asset.url} muted className="canvas-node-media" />
          ) : (
            <img src={asset.url} alt="" className="canvas-node-media" />
          )
        ) : (
          <div className="asset-art canvas-node-art" aria-hidden />
        )}
        <span className="badge canvas-node-type-badge">
          {asset?.type === 'video' ? (
            <>
              <Film size={10} /> {t('common.video')}
            </>
          ) : (
            <>
              <ImageIcon size={10} /> {t('common.image')}
            </>
          )}
        </span>
      </div>
      <div className="canvas-node-body">
        <div className="canvas-node-id mono">{asset?.id ?? data.assetId}</div>
        {missing ? (
          <div className="canvas-node-meta canvas-node-error">{t('canvas.asset.missing')}</div>
        ) : (
          <>
            <div className="canvas-node-meta mono">{asset.dim}</div>
            <div className="canvas-node-prompt" title={asset.prompt}>
              {asset.prompt || '—'}
            </div>
          </>
        )}
        {asset && (
          <button
            type="button"
            className="btn btn-ghost btn-sm canvas-node-action"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(asset.id);
            }}
          >
            <ExternalLink size={12} /> {t('canvas.asset.detail')}
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(AssetNodeView);
