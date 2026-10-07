import type { ReactNode } from 'react';
import { Navigate, NavLink, useLocation } from 'react-router';
import { Compass, Download, Gamepad2, Home, Music, Settings, Store } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { isAuthConfigured } from '../lib/env';
import { LogoMark } from './Logo';
import { ButtonLink } from './Button';

const nav = [
  { to: '/dashboard', label: 'Home', icon: Home },
  { to: '/dashboard/games', label: 'My games', icon: Gamepad2 },
  { to: '/dashboard/music', label: 'Music', icon: Music },
  { to: '/dashboard/exports', label: 'Exports', icon: Download },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/market', label: 'Marketplace', icon: Store },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (!isAuthConfigured) return <>{children}</>;
  if (loading) return <div className="grid min-h-screen place-items-center text-muted">Loading…</div>;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  return <>{children}</>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth();
  return (
    <div className="flex min-h-screen flex-wrap">
      <nav aria-label="Main" className="flex max-w-[260px] flex-[1_1_220px] flex-col gap-1 border-r border-[#1F222B] bg-sunken px-3.5 py-5 text-[15px]">
        <NavLink to="/" className="flex items-center gap-2.5 px-2.5 pb-4 text-white">
          <LogoMark size={24} hole="#121419" />
          <span className="font-display text-xl font-bold">degamed</span>
        </NavLink>
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2.5 ${isActive ? 'bg-[#1F2230] text-white' : 'text-ink-2 hover:text-white'}`
            }
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
        <div className="mt-auto flex flex-col gap-2 rounded-xl border border-[#3A2F80] bg-[#17142A] p-3.5">
          <span className="text-[13px] text-muted">Plan</span>
          <strong>Free</strong>
          <ButtonLink to="/pricing" className="!min-h-9 !py-2 text-sm">
            Upgrade
          </ButtonLink>
        </div>
        {session && (
          <button type="button" onClick={signOut} className="mt-2 rounded-lg px-3 py-2 text-left text-sm text-muted hover:text-white">
            Sign out ({session.user.email})
          </button>
        )}
      </nav>
      <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-7 px-8 py-7">{children}</main>
    </div>
  );
}
