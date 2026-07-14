import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { animate } from 'animejs';
import { X, ExternalLink } from 'lucide-react';
import { useGeneration, type GenStatus } from '../state/GenerationContext';
import { useI18n } from '../i18n/useI18n';

const STAGE_KEYS = [
  'runway.stage.prompt',
  'runway.stage.queue',
  'runway.stage.render',
  'runway.stage.asset',
] as const;

function stageIndex(status: GenStatus): number {
  switch (status) {
    case 'queued':
      return 1;
    case 'running':
      return 2;
    case 'success':
      return 3;
    case 'failed':
      return 2;
    default:
      return -1;
  }
}

function nodeClass(index: number, status: GenStatus): string {
  const active = stageIndex(status);
  if (status === 'idle') return '';
  if (status === 'failed' && index === active) return 'active-failed';
  if (index < active) return 'done';
  if (index === active) {
    if (status === 'queued') return 'active-queued';
    if (status === 'running') return 'active-running';
    if (status === 'success') return 'active-success';
  }
  return '';
}

const Runway = () => {
  const { job, status, reset, lastCompletedId, progress } = useGeneration();
  const { t, statusLabel } = useI18n();
  const pathRef = useRef<SVGLineElement>(null);
  const animRef = useRef<{ pause?: () => void } | null>(null);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const line = pathRef.current;
    if (!line) return;

    if (animRef.current?.pause) {
      animRef.current.pause();
      animRef.current = null;
    }

    if (status === 'idle' || prefersReduced) {
      line.style.opacity = status === 'idle' ? '0' : '1';
      line.style.strokeDashoffset = status === 'success' ? '0' : '100';
      return;
    }

    line.style.opacity = '1';

    if (status === 'queued') {
      animRef.current = animate(line, {
        strokeDashoffset: [100, 55],
        duration: 1100,
        ease: 'inOutSine',
      }) as { pause?: () => void };
    } else if (status === 'running') {
      line.style.strokeDasharray = '12 8';
      animRef.current = animate(line, {
        strokeDashoffset: [40, 0],
        duration: 900,
        ease: 'linear',
        loop: true,
      }) as { pause?: () => void };
    } else if (status === 'success') {
      animRef.current = animate(line, {
        strokeDashoffset: 0,
        duration: 400,
        ease: 'outQuad',
      }) as { pause?: () => void };
    }

    return () => {
      if (animRef.current?.pause) animRef.current.pause();
    };
  }, [status]);

  const displayId = job?.id ?? (lastCompletedId ? `last ${lastCompletedId}` : '—');
  const isActive = status !== 'idle';
  const pct = isActive ? Math.round(progress) : 0;

  const stageCopy = (() => {
    const id = job?.id;
    switch (status) {
      case 'queued':
        return id ? t('runway.queued', { id }) : t('runway.queued.plain');
      case 'running':
        return id ? t('runway.running', { id }) : t('runway.running.plain');
      case 'success':
        return id ? t('runway.success', { id }) : t('runway.success.plain');
      case 'failed':
        return id ? t('runway.failed', { id }) : t('runway.failed.plain');
      default:
        return t('runway.standby');
    }
  })();

  return (
    <div
      className={`runway-container ${isActive ? 'is-active' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={t('runway.label')}
    >
      <div className="runway-progress" style={{ width: `${pct}%` }} aria-hidden />

      <div className="runway-meta">
        <span className="runway-meta-label">
          {isActive ? t('runway.active') : t('runway.title')}
        </span>
        <span className="runway-meta-value mono" title={displayId}>
          {displayId}
        </span>
        {isActive ? (
          <span className={`status-pill ${status === 'success' ? 'success' : status}`}>
            {statusLabel(status)}
            {status !== 'success' && (
              <span className="tabular" style={{ opacity: 0.85 }}>
                {' '}
                {pct}%
              </span>
            )}
          </span>
        ) : (
          <span className="runway-meta-status mono">{t('common.idle')}</span>
        )}
      </div>

      <div className="runway-track-wrap">
        <div className="runway-stage-copy mono">{stageCopy}</div>
        <div className="runway-track">
          <svg className="runway-path-svg" aria-hidden="true">
            <line
              x1="0%"
              y1="50%"
              x2="100%"
              y2="50%"
              className="runway-path-line"
              ref={pathRef}
              style={{
                strokeDasharray: '12 8',
                strokeDashoffset: 100,
                opacity: 0,
                stroke:
                  status === 'success'
                    ? 'var(--status-success)'
                    : status === 'queued'
                      ? 'var(--status-queued)'
                      : 'var(--status-running)',
              }}
            />
          </svg>

          {STAGE_KEYS.map((key, i) => (
            <div key={key} className={`runway-node ${nodeClass(i, status)}`}>
              <div className="runway-label">{t(key)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="runway-actions">
        {status === 'success' && (
          <Link to="/assets" className="btn btn-secondary btn-sm">
            <ExternalLink size={14} />
            <span>{t('runway.assets')}</span>
          </Link>
        )}
        {status !== 'idle' && status !== 'success' && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={reset}
            title={t('common.cancel')}
          >
            <X size={14} />
            <span>{t('common.cancel')}</span>
          </button>
        )}
        {status === 'idle' && (
          <span className="runway-ready mono">{t('common.ready')}</span>
        )}
      </div>
    </div>
  );
};

export default Runway;
