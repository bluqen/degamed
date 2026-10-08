import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import './app.css';
import { AuthProvider } from './lib/auth';
import { RequireAuth } from './components/AppShell';
import { Landing } from './pages/Landing';
import { Pricing } from './pages/Pricing';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { NewGame } from './pages/NewGame';
import { ComingSoon, NotFound } from './pages/Placeholder';
import { ArtLab } from './pages/ArtLab';
import { Settings } from './pages/Settings';

const guard = (el: React.ReactNode) => <RequireAuth>{el}</RequireAuth>;

// The editor (code editor, scene tools, engine templates) is big; load it only when it's opened.
const LazyEditor = lazy(() => import('./pages/Editor').then((m) => ({ default: m.Editor })));
const Editor = () => (
  <Suspense fallback={<div className="flex h-screen items-center justify-center bg-bg text-muted">Opening the editor…</div>}>
    <LazyEditor />
  </Suspense>
);

const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/pricing', element: <Pricing /> },
  { path: '/login', element: <Login /> },
  { path: '/dashboard', element: guard(<Dashboard />) },
  { path: '/new', element: guard(<NewGame />) },
  { path: '/editor/demo', element: <Editor /> },
  { path: '/editor/:id', element: guard(<Editor />) },
  { path: '/settings', element: guard(<Settings />) },
  { path: '/art', element: guard(<ArtLab />) },
  {
    path: '/dashboard/:section',
    element: guard(<ComingSoon title="Coming soon" body="This section arrives in a later milestone." />),
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
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
