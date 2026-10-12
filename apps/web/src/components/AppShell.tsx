import type { ReactNode } from 'react';
import { Navigate, NavLink, useLocation } from 'react-router';
import { useAuth } from '../lib/auth';
import { isAuthConfigured } from '../lib/env';
import { AppHeader } from './AppHeader';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (!isAuthConfigured) return <>{children}</>;
  if (loading)
    return <div className="grid min-h-screen place-items-center text-muted">Loading…</div>;
  if (!session)
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  return <>{children}</>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth();
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        right={
          <>
            <NavLink
              to="/create"
              className={({ isActive }) =>
                `hidden h-10 items-center rounded-md px-3 text-body font-semibold sm:inline-flex ${isActive ? 'text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'}`
              }
            >
              My games
            </NavLink>
            {session && (
              <button
                type="button"
                onClick={signOut}
                className="hidden h-10 items-center rounded-md px-3 text-body font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink sm:inline-flex"
              >
                Sign out
              </button>
            )}
          </>
        }
      />
      <main className="mx-auto flex w-full max-w-[880px] min-w-0 flex-1 flex-col gap-7 px-4 py-10 sm:px-6">
        {children}
      </main>
    </div>
  );
}
