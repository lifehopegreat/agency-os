import React, { useEffect, useRef } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  useLocation,
} from 'react-router-dom';
import {
  SquareTerminal,
  ListTree,
  Image as ImageIcon,
  Settings2,
  Activity,
  Cpu,
  Languages,
  ScanSearch,
  LayoutGrid,
} from 'lucide-react';
import { animate } from 'animejs';
import CreatePage from './pages/Create';
import QueuePage from './pages/Queue';
import AssetsPage from './pages/Assets';
import ReversePage from './pages/Reverse';
import CanvasPage from './pages/Canvas';
import ProvidersPage from './pages/Providers';
import UsagePage from './pages/Usage';
import SettingsPage from './pages/Settings';
import Runway from './components/Runway';
import Toast from './components/Toast';
import { GenerationProvider, useGeneration, useSuccessSound } from './state/GenerationContext';
import { PreferencesProvider, usePreferences } from './state/PreferencesContext';
import { PromptLibraryProvider } from './state/PromptLibraryContext';
import { ProvidersProvider } from './state/ProvidersContext';
import { useI18n } from './i18n/useI18n';
import type { Locale } from './i18n/locales';

const navDefs = [
  { path: '/', icon: SquareTerminal, labelKey: 'app.nav.create', section: 'work' },
  { path: '/reverse', icon: ScanSearch, labelKey: 'app.nav.reverse', section: 'work' },
  { path: '/canvas', icon: LayoutGrid, labelKey: 'app.nav.canvas', section: 'work' },
  { path: '/queue', icon: ListTree, labelKey: 'app.nav.queue', section: 'work', badge: true },
  { path: '/assets', icon: ImageIcon, labelKey: 'app.nav.assets', section: 'work' },
  { path: '/providers', icon: Cpu, labelKey: 'app.nav.providers', section: 'system' },
  { path: '/usage', icon: Activity, labelKey: 'app.nav.usage', section: 'system' },
  { path: '/settings', icon: Settings2, labelKey: 'app.nav.settings', section: 'system' },
] as const;

const Navigation = () => {
  const { status, library } = useGeneration();
  const { t, locale, setLocale } = useI18n();
  const live = status === 'queued' || status === 'running' ? 1 : 0;
  const work = navDefs.filter((i) => i.section === 'work');
  const system = navDefs.filter((i) => i.section === 'system');
  const statusWord = live ? t('app.status.busy') : t('app.status.online');

  const toggleLocale = () => {
    const next: Locale = locale === 'zh' ? 'en' : 'zh';
    setLocale(next);
  };

  return (
    <nav className="sidebar" aria-label={t('app.nav.primary')}>
      <div className="brand">
        <div className="brand-mark" aria-hidden>
          <div className="brand-mark-inner" />
        </div>
        <div className="brand-text">
          <span className="brand-name">AGENCY_OS</span>
          <span className="brand-tag">{t('app.brandTag')}</span>
        </div>
      </div>

      <div className="nav-links">
        <div className="nav-section-label">{t('app.nav.work')}</div>
        {work.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <item.icon size={17} strokeWidth={1.75} />
            <span>{t(item.labelKey)}</span>
            {'badge' in item && item.badge && live > 0 && (
              <span className="nav-badge mono tabular" aria-label={`${live} ${t('common.live')}`}>
                {live}
              </span>
            )}
            {item.path === '/assets' && library.length > 0 && (
              <span className="nav-badge muted mono tabular">{library.length}</span>
            )}
          </NavLink>
        ))}

        <div className="nav-section-label">{t('app.nav.system')}</div>
        {system.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <item.icon size={17} strokeWidth={1.75} />
            <span>{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </div>

      <div className="sidebar-footer">
        <button
          type="button"
          className="lang-toggle"
          onClick={toggleLocale}
          title={t('app.lang.switch')}
          aria-label={t('app.lang.switch')}
        >
          <Languages size={14} />
          <span className="mono">{locale === 'zh' ? '中文' : 'EN'}</span>
          <span className="lang-toggle-hint mono">
            {locale === 'zh' ? 'EN' : '中文'}
          </span>
        </button>
        <div className="workspace-status">
          <div className={`status-indicator ${live ? 'busy' : 'online'}`} aria-hidden />
          <span>
            <span className="sr-only">{t('app.status.label', { status: statusWord })} </span>
            WS · PROD
          </span>
        </div>
      </div>
    </nav>
  );
};

const PageWrapper = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (pageRef.current && !prefersReduced) {
      animate(pageRef.current, {
        opacity: [0, 1],
        duration: 200,
        ease: 'outQuad',
      });
    }
  }, [location.pathname]);

  return (
    <main className="main-content" ref={pageRef} id="main">
      {children}
    </main>
  );
};

function AppShell() {
  const { completionSound } = usePreferences();
  const { t } = useI18n();
  useSuccessSound(completionSound);

  return (
    <div className="app-container">
      <a href="#main" className="skip-link">
        {t('app.skip')}
      </a>
      <Navigation />
      <div className="content-area">
        <Routes>
          <Route path="/" element={<PageWrapper><CreatePage /></PageWrapper>} />
          <Route path="/reverse" element={<PageWrapper><ReversePage /></PageWrapper>} />
          <Route path="/canvas" element={<PageWrapper><CanvasPage /></PageWrapper>} />
          <Route path="/queue" element={<PageWrapper><QueuePage /></PageWrapper>} />
          <Route path="/assets" element={<PageWrapper><AssetsPage /></PageWrapper>} />
          <Route path="/providers" element={<PageWrapper><ProvidersPage /></PageWrapper>} />
          <Route path="/usage" element={<PageWrapper><UsagePage /></PageWrapper>} />
          <Route path="/settings" element={<PageWrapper><SettingsPage /></PageWrapper>} />
          <Route
            path="*"
            element={
              <PageWrapper>
                <div className="empty-state">
                  <div className="empty-state-title">{t('app.notFound.title')}</div>
                  <p className="empty-state-desc">{t('app.notFound.desc')}</p>
                  <NavLink to="/" className="btn btn-primary btn-sm">
                    {t('app.notFound.back')}
                  </NavLink>
                </div>
              </PageWrapper>
            }
          />
        </Routes>
        <Runway />
        <Toast />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <PreferencesProvider>
      <GenerationProvider>
        <ProvidersProvider>
          <PromptLibraryProvider>
            <Router>
              <AppShell />
            </Router>
          </PromptLibraryProvider>
        </ProvidersProvider>
      </GenerationProvider>
    </PreferencesProvider>
  );
}
