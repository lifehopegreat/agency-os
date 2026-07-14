import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { animate } from 'animejs';
import { CheckCircle2, Info, XCircle, X } from 'lucide-react';
import { useGeneration } from '../state/GenerationContext';
import { useI18n } from '../i18n/useI18n';

const icons = {
  success: CheckCircle2,
  info: Info,
  error: XCircle,
};

export default function Toast() {
  const { toast, dismissToast } = useGeneration();
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast || !ref.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    animate(ref.current, {
      translateY: [12, 0],
      opacity: [0, 1],
      duration: 240,
      ease: 'outQuad',
    });
  }, [toast]);

  if (!toast) return null;

  const Icon = icons[toast.tone];

  return (
    <div
      ref={ref}
      className={`toast toast-${toast.tone}`}
      role="status"
      aria-live="polite"
    >
      <Icon size={16} className="toast-icon" />
      <div className="toast-body">
        <div className="toast-title">{toast.title}</div>
        {toast.body && <div className="toast-meta mono">{toast.body}</div>}
      </div>
      {toast.tone === 'success' && (
        <Link to="/assets" className="btn btn-ghost btn-sm" onClick={dismissToast}>
          {t('common.view')}
        </Link>
      )}
      <button
        type="button"
        className="btn btn-ghost btn-sm toast-close"
        onClick={dismissToast}
        aria-label={t('common.dismiss')}
      >
        <X size={14} />
      </button>
    </div>
  );
}
