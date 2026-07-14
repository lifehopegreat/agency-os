import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { useGeneration } from '../state/GenerationContext';
import { useI18n } from '../i18n/useI18n';

const UsagePage = () => {
  const { library, sessionJobs } = useGeneration();
  const { t } = useI18n();

  const stats = useMemo(() => {
    const total = sessionJobs.length;
    const success = sessionJobs.filter((j) => j.status === 'success').length;
    const failed = sessionJobs.filter((j) => j.status === 'failed').length;
    const rate =
      total === 0 ? '—' : `${((success / total) * 100).toFixed(total ? 1 : 0)}%`;

    const finished = sessionJobs.filter((j) => j.finishedAt);
    const avgMs =
      finished.length === 0
        ? null
        : finished.reduce((sum, j) => sum + ((j.finishedAt ?? 0) - j.startedAt), 0) /
          finished.length;
    const latency =
      avgMs == null ? '—' : avgMs < 1000 ? `${Math.round(avgMs)}ms` : `${(avgMs / 1000).toFixed(1)}s`;

    return [
      {
        key: 'jobs',
        label: t('usage.jobs'),
        value: String(total),
        sub: t('usage.jobs.subReal', { n: library.length }),
      },
      {
        key: 'rate',
        label: t('usage.rate'),
        value: rate,
        sub: t('usage.rate.subReal', { n: failed }),
      },
      {
        key: 'assets',
        label: t('usage.assets'),
        value: String(library.length),
        sub: t('usage.assets.sub'),
      },
      {
        key: 'lat',
        label: t('usage.latency'),
        value: latency,
        sub: t('usage.latency.sub'),
      },
    ];
  }, [sessionJobs, library.length, t]);

  const modelBars = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of library) {
      map.set(a.model, (map.get(a.model) ?? 0) + 1);
    }
    const entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
    const max = entries[0]?.[1] ?? 1;
    return entries.map(([name, count]) => ({
      name,
      count,
      pct: Math.max(4, Math.round((count / max) * 100)),
    }));
  }, [library]);

  const empty = sessionJobs.length === 0 && library.length === 0;

  return (
    <div className="usage-page">
      <header className="page-header">
        <div className="page-header-text">
          <div className="page-kicker">{t('usage.kicker')}</div>
          <h1 className="page-title">{t('usage.title')}</h1>
          <p className="page-desc">{t('usage.desc', { n: library.length })}</p>
        </div>
        <span className="badge mono">{t('usage.session')}</span>
      </header>

      {empty ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Activity size={22} />
          </div>
          <div className="empty-state-title">{t('usage.empty.title')}</div>
          <p className="empty-state-desc">{t('usage.empty.desc')}</p>
        </div>
      ) : (
        <>
          <div className="stat-grid">
            {stats.map((s) => (
              <div key={s.key} className="card stat-card">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value mono tabular">{s.value}</div>
                <div className="stat-sub">{s.sub}</div>
              </div>
            ))}
          </div>

          <div className="usage-panels">
            <div className="card">
              <div className="card-header">{t('usage.byModel')}</div>
              {modelBars.length === 0 ? (
                <p className="page-desc" style={{ margin: 0 }}>
                  {t('usage.byModel.empty')}
                </p>
              ) : (
                <div className="bar-list">
                  {modelBars.map((m) => (
                    <div key={m.name} className="bar-row">
                      <div className="bar-row-top mono">
                        <span>{m.name}</span>
                        <span className="tabular">{m.count}</span>
                      </div>
                      <div className="mini-progress">
                        <div
                          className="mini-progress-fill brand"
                          style={{ width: `${m.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UsagePage;
