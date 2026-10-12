import { lazy, StrictMode, Suspense, type ComponentType, type ReactNode } from 'react';
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
import { ComingSoon, NotFound } from './pages/Placeholder';
import { RouteError } from './pages/RouteError';

const guard = (el: React.ReactNode) => <RequireAuth>{el}</RequireAuth>;

/**
 * Everything but the landing, pricing and login pages loads on demand, so the first visit
 * stays light and a broken module in one area can't blank the whole site.
 */
function page<T extends Record<string, unknown>>(load: () => Promise<T>, name: keyof T, fallback: ReactNode = <PageLoading />) {
  const Lazy = lazy(() => load().then((m) => ({ default: m[name] as ComponentType })));
  return function Page() {
    return (
      <Suspense fallback={fallback}>
        <Lazy />
      </Suspense>
    );
  };
}

function PageLoading({ label }: { label?: string }) {
  return (
    <div className="flex h-dvh items-center justify-center bg-bg text-body text-muted" aria-busy="true">
      {label ?? ''}
    </div>
  );
}

const Create = page(() => import('./pages/Create'), 'Create');
const Studio = page(() => import('./pages/Studio'), 'StudioPage');
const Play = page(() => import('./pages/Play'), 'PlayPage');
const Advanced = page(() => import('./pages/Editor'), 'Editor', <PageLoading label="Opening the advanced editor…" />);
const Dashboard = page(() => import('./pages/Dashboard'), 'Dashboard');
const Settings = page(() => import('./pages/Settings'), 'Settings');
const ArtLab = page(() => import('./pages/ArtLab'), 'ArtLab');

const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/create', element: <Create /> },
      { path: '/new', element: <Navigate to="/create" replace /> },
      // The Studio: play + chat + simple tweaks. /editor/demo is the shared test game.
      { path: '/editor/:id', element: <Studio /> },
      { path: '/editor/:id/advanced', element: <Advanced /> },
      { path: '/play/:id', element: <Play /> },
      { path: '/p/:code', element: <Play /> },
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
    ],
  },
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
