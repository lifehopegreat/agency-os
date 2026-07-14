import React, { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Loader2, Play, AlertTriangle } from 'lucide-react';
import type { CanvasGenerationNodeData, CanvasAssetNodeData, ReferenceRole } from '../../state/canvasTypes';
import {
  outputSpecs,
  referenceCapabilities,
  referenceModeForInputs,
  videoDurationOptions,
} from '../../lib/modelCapabilities';
import { useI18n } from '../../i18n/useI18n';
import { useCanvasRuntime } from './canvasRuntime';

export type GenerationFlowNode = Node<CanvasGenerationNodeData, 'generation'>;

const ROLES: ReferenceRole[] = [
  'subject',
  'composition',
  'style',
  'color',
  'first-frame',
  'motion',
  'reference',
];

function GenerationNodeView({ id, data, selected }: NodeProps<GenerationFlowNode>) {
  const { t } = useI18n();
  const {
    library,
    nodes,
    imageModels,
    videoModels,
    allModels,
    busy,
    onChangeGen,
    onRun,
    onReorderRef,
    onRemoveRef,
    onRoleChange,
  } = useCanvasRuntime();

  const models =
    data.type === 'video'
      ? videoModels.length
        ? videoModels
        : allModels
      : imageModels.length
        ? imageModels
        : allModels;

  const model = models.find((m) => m.key === data.modelKey) ?? models[0];
  const modelId = model?.modelId;
  const specs = outputSpecs(modelId, data.type);
  const durationOpts = videoDurationOptions(modelId);

  const refs = useMemo(
    () =>
      data.referenceNodeIds.map((nid) => {
        const n = nodes.find((x) => x.id === nid);
        const assetId =
          n?.type === 'asset' ? (n.data as CanvasAssetNodeData).assetId : null;
        const asset = assetId ? library.find((a) => a.id === assetId) : undefined;
        return { nodeId: nid, asset };
      }),
    [data.referenceNodeIds, nodes, library],
  );

  const imageCount = refs.filter((r) => r.asset?.type === 'image').length;
  const videoCount = refs.filter((r) => r.asset?.type === 'video').length;
  const referenceMode = referenceModeForInputs(
    data.type,
    refs.flatMap((ref) =>
      ref.asset
        ? [{
            kind: ref.asset.type as 'image' | 'video',
            firstFrame: data.referenceRoles[ref.nodeId] === 'first-frame',
          }]
        : [],
    ),
  );
  const caps = referenceCapabilities(modelId, data.type, referenceMode);
  const overImage = imageCount > caps.imageLimit;
  const overVideo = videoCount > caps.videoLimit;
  const imageUnsupported = imageCount > 0 && caps.imageLimit === 0;
  const videoUnsupported = videoCount > 0 && caps.videoLimit === 0;
  const limitKind = videoCount > 0 ? caps.videoLimitKind : caps.imageLimitKind;
  const canRun =
    Boolean(data.prompt.trim()) &&
    Boolean(model) &&
    !overImage &&
    !overVideo &&
    data.status !== 'running' &&
    data.status !== 'waiting' &&
    !busy;

  const statusClass =
    data.status === 'running'
      ? 'running'
      : data.status === 'failed'
        ? 'failed'
        : data.status === 'success'
          ? 'success'
          : data.status === 'waiting'
            ? 'queued'
            : 'idle';

  return (
    <div
      className={`canvas-node canvas-node-gen ${selected ? 'is-selected' : ''} status-${data.status}`}
    >
      <Handle type="target" position={Position.Left} className="canvas-handle" />
      <Handle type="source" position={Position.Right} className="canvas-handle" />

      <div className="canvas-gen-head">
        <span className="canvas-gen-title">
          {data.type === 'video' ? t('canvas.gen.video') : t('canvas.gen.image')}
        </span>
        <span className={`status-pill ${statusClass}`}>{t(`canvas.status.${data.status}`)}</span>
      </div>

      <div className="canvas-gen-fields nodrag nopan">
        <label className="canvas-field">
          <span>{t('create.model')}</span>
          <select
            value={data.modelKey || model?.key || ''}
            onChange={(e) => onChangeGen(id, { modelKey: e.target.value })}
            disabled={!models.length}
          >
            {models.length === 0 ? (
              <option value="">{t('create.model.empty')}</option>
            ) : (
              models.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.providerName} · {m.label}
                </option>
              ))
            )}
          </select>
        </label>

        <label className="canvas-field">
          <span>{t('create.prompt')}</span>
          <textarea
            rows={3}
            value={data.prompt}
            onChange={(e) => onChangeGen(id, { prompt: e.target.value.slice(0, 2000) })}
            placeholder={t('create.prompt.placeholder')}
          />
          {!data.prompt.trim() && (
            <span className="canvas-field-hint">{t('canvas.prompt.empty')}</span>
          )}
        </label>

        <div className="canvas-field-row">
          <label className="canvas-field">
            <span>{t('create.aspect')}</span>
            <select
              value={data.ratio}
              onChange={(e) => onChangeGen(id, { ratio: e.target.value })}
            >
              <option value="1:1">1:1</option>
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
            </select>
          </label>
          <label className="canvas-field">
            <span>{t('create.quality')}</span>
            <select
              value={data.quality}
              onChange={(e) => onChangeGen(id, { quality: e.target.value })}
            >
              {specs.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="canvas-field-row">
          {data.type === 'video' ? (
            <label className="canvas-field">
              <span>{t('create.duration')}</span>
              <select
                value={data.duration}
                onChange={(e) => onChangeGen(id, { duration: Number(e.target.value) })}
              >
                {(durationOpts ?? [4, 6, 8]).map((d) => (
                  <option key={d} value={d}>
                    {d}s
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="canvas-field" />
          )}
          <label className="canvas-field">
            <span>{t('create.seed')}</span>
            <input
              type="text"
              value={data.seed}
              placeholder="—"
              onChange={(e) => onChangeGen(id, { seed: e.target.value.slice(0, 32) })}
            />
          </label>
        </div>

        <div className="canvas-caps mono">
          {t('canvas.caps.summary', {
            img: imageCount,
            imgMax: caps.imageLimit,
            vid: videoCount,
            vidMax: caps.videoLimit,
            ratio: data.ratio,
            quality: specs.find((s) => s.value === data.quality)?.label ?? data.quality,
          })}
          {' · '}{t(`canvas.caps.${limitKind}`)}
        </div>

        <div className="canvas-refs">
          <div className="canvas-refs-head">
            <span>{t('canvas.refs')}</span>
            <span className="mono">
              {t('canvas.refs.count', {
                img: imageCount,
                imgMax: caps.imageLimit,
                vid: videoCount,
                vidMax: caps.videoLimit,
              })}
            </span>
          </div>
          {refs.length === 0 ? (
            <p className="canvas-refs-empty">{t('canvas.refs.empty')}</p>
          ) : (
            <ul className="canvas-refs-list">
              {refs.map((r, index) => (
                <li key={r.nodeId} className="canvas-ref-item">
                  <span className="canvas-ref-order mono">{index + 1}</span>
                  <div
                    className="canvas-ref-thumb"
                    style={
                      r.asset
                        ? ({ '--asset-hue': String(r.asset.hue) } as React.CSSProperties)
                        : undefined
                    }
                  >
                    {r.asset?.url ? (
                      <img src={r.asset.url} alt="" />
                    ) : (
                      <div className="asset-art" />
                    )}
                  </div>
                  <select
                    className="canvas-ref-role"
                    value={data.referenceRoles[r.nodeId] ?? 'reference'}
                    onChange={(e) =>
                      onRoleChange(id, r.nodeId, e.target.value as ReferenceRole)
                    }
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {t(`canvas.role.${role}`)}
                      </option>
                    ))}
                  </select>
                  <div className="canvas-ref-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={index === 0}
                      onClick={() => onReorderRef(id, index, index - 1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={index >= refs.length - 1}
                      onClick={() => onReorderRef(id, index, index + 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => onRemoveRef(id, r.nodeId)}
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {(overImage || overVideo) && (
            <div className="canvas-gen-warn">
              <AlertTriangle size={12} />
              {imageUnsupported
                ? t('canvas.warn.imagesUnsupported')
                : videoUnsupported
                  ? t('canvas.warn.videosUnsupported')
                  : overImage
                ? t('canvas.warn.images', { n: caps.imageLimit })
                : t('canvas.warn.videos', { n: caps.videoLimit })}
            </div>
          )}
        </div>

        {data.lastError && (
          <div className="canvas-gen-error">
            <AlertTriangle size={12} /> {data.lastError}
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary btn-block btn-sm"
          disabled={!canRun}
          onClick={() => onRun(id)}
        >
          {data.status === 'running' || data.status === 'waiting' ? (
            <>
              <Loader2 size={14} className="spin" /> {t('canvas.gen.running')}
            </>
          ) : (
            <>
              <Play size={14} /> {t('canvas.gen.run')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default memo(GenerationNodeView);
