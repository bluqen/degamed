import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import './app.css';
import { AuthProvider } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import { ToastProvider } from './ui';
import { RequireAuth } from './components/AppShell';
import { Landing } from './pages/Landing';
import { Pricing } from './pages/Pricing';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Create } from './pages/Create';
import { StudioPage } from './pages/Studio';
import { PlayPage } from './pages/Play';
import { ComingSoon, NotFound } from './pages/Placeholder';
import { ArtLab } from './pages/ArtLab';
import { Settings } from './pages/Settings';

const guard = (el: React.ReactNode) => <RequireAuth>{el}</RequireAuth>;

// The Advanced editor (code editor, scene tools) is big; load it only when it's opened.
const LazyAdvanced = lazy(() => import('./pages/Editor').then((m) => ({ default: m.Editor })));
const Advanced = () => (
  <Suspense fallback={<div className="flex h-dvh items-center justify-center bg-bg text-body text-muted">Opening the advanced editor…</div>}>
    <LazyAdvanced />
  </Suspense>
);

const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/create', element: <Create /> },
  { path: '/new', element: <Navigate to="/create" replace /> },
  // The Studio: play + chat + simple tweaks. /editor/demo is the shared test game.
  { path: '/editor/:id', element: <StudioPage /> },
  { path: '/editor/:id/advanced', element: <Advanced /> },
  { path: '/play/:id', element: <PlayPage /> },
  { path: '/p/:code', element: <PlayPage /> },
  { path: '/pricing', element: <Pricing /> },
  { path: '/login', element: <Login /> },
  { path: '/dashboard', element: guard(<Dashboard />) },
  { path: '/settings', element: <Settings /> },
  { path: '/art', element: guard(<ArtLab />) },
  {
    path: '/dashboard/:section',
    element: guard(<ComingSoon title="Coming soon" body="This section arrives in a later update." />),
  },
  {
    path: '/explore',
    element: <ComingSoon shell="site" title="Explore" body="The community gallery opens once publishing is ready." />,
  },
  {
    path: '/market',
    element: <ComingSoon shell="site" title="Marketplace" body="Templates, art packs and music packs are coming." />,
  },
  { path: '*', element: <NotFound /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
);
