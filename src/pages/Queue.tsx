import React, { useEffect, useMemo, useRef } from 'react';
import { animate, stagger } from 'animejs';
import { XCircle, ExternalLink, ListTree } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGeneration } from '../state/GenerationContext';
import { useI18n } from '../i18n/useI18n';

const QueuePage = () => {
  const listRef = useRef<HTMLDivElement>(null);
  const { sessionJobs, job, progress, reset } = useGeneration();
  const { t, statusLabel } = useI18n();

  const tasks = useMemo(() => {
    return sessionJobs.map((item) => {
      const isLive = job?.id === item.id;
      const status =
        isLive && job
          ? job.status === 'success'
            ? 'completed'
            : job.status === 'failed'
              ? 'failed'
              : job.status
          : item.status === 'success'
            ? 'completed'
            : item.status === 'failed'
              ? 'failed'
              : item.status === 'running'
                ? 'running'
                : item.status === 'queued'
                  ? 'queued'
                  : 'completed';

      return {
        id: item.id,
        status: status as 'running' | 'queued' | 'failed' | 'completed',
        model: item.model,
        prompt: item.prompt,
        params: {
          type: item.type,
          ...(item.ratio ? { ratio: item.ratio } : {}),
        },
        time:
          status === 'completed' || status === 'failed'
            ? t('common.done')
            : status === 'running'
              ? t('common.live')
              : t('common.waiting'),
        live: isLive && (status === 'queued' || status === 'running'),
        progress:
          isLive && (status === 'queued' || status === 'running')
            ? progress
            : status === 'completed'
              ? 100
              : undefined,
      };
    });
  }, [sessionJobs, job, progress, t]);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (listRef.current && !prefersReduced && tasks.length > 0) {
      animate(listRef.current.querySelectorAll('.queue-item'), {
        translateY: [10, 0],
        opacity: [0, 1],
        duration: 320,
        delay: stagger(60),
        ease: 'outQuad',
      });
    }
  }, [tasks.length]);

  return (
    <div className="queue-page">
      <header className="page-header">
        <div className="page-header-text">
          <div className="page-kicker">{t('queue.kicker')}</div>
          <h1 className="page-title">{t('queue.title')}</h1>
          <p className="page-desc">{t('queue.desc')}</p>
        </div>
        <span className="badge mono tabular">{t('common.jobs', { n: tasks.length })}</span>
      </header>

      {tasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <ListTree size={22} />
          </div>
          <div className="empty-state-title">{t('queue.empty.title')}</div>
          <p className="empty-state-desc">{t('queue.empty.desc')}</p>
          <Link to="/" className="btn btn-primary btn-sm">
            {t('common.newGeneration')}
          </Link>
        </div>
      ) : (
        <div className="queue-list" ref={listRef}>
          {tasks.map((task) => (
            <article key={task.id} className={`card queue-item ${task.status}`}>
              <div className="queue-item-top">
                <div>
                  <div className="queue-id-row">
                    <span className="queue-id mono tabular">{task.id}</span>
                    <span className={`status-pill ${task.status}`}>
                      {statusLabel(task.status)}
                      {task.live ? ` · ${t('common.live')}` : ''}
                    </span>
                  </div>
                  <div className="queue-model">{task.model}</div>
                </div>
                <div className="queue-time tabular">{task.time}</div>
              </div>

              <p className="queue-prompt">{task.prompt}</p>

              <div className="param-row">
                {Object.entries(task.params).map(([k, v]) => (
                  <span key={k} className="badge">
                    {k}:{v}
                  </span>
                ))}
              </div>

              {typeof task.progress === 'number' &&
                (task.status === 'running' || task.status === 'queued') && (
                  <div className="queue-progress">
                    <div className="queue-progress-meta mono tabular">
                      <span>
                        {task.status === 'queued'
                          ? t('common.waiting')
                          : t('common.render')}
                      </span>
                      <span>{Math.round(task.progress)}%</span>
                    </div>
                    <div className="mini-progress">
                      <div
                        className={`mini-progress-fill ${task.status}`}
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>
                )}

              <div className="queue-actions">
                {task.status === 'completed' ? (
                  <Link to="/assets" className="btn btn-ghost btn-sm">
                    <ExternalLink size={14} /> {t('queue.viewResult')}
                  </Link>
                ) : task.status === 'queued' || task.status === 'running' ? (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      if (task.live) reset();
                    }}
                  >
                    <XCircle size={14} /> {t('common.cancel')}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default QueuePage;
