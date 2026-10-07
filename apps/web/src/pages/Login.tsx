import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { Logo } from '../components/Logo';
import { useAuth } from '../lib/auth';
import { isGoogleConfigured } from '../lib/env';
import { mountGoogleButton } from '../lib/google-auth';

export function Login() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/dashboard';
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isGoogleConfigured || !buttonRef.current) return;
    mountGoogleButton(buttonRef.current, {
      onSignedIn: () => navigate(next, { replace: true }),
      onError: setError,
    }).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Google sign-in failed'));
  }, [navigate, next]);

  if (!loading && session) return <Navigate to={next} replace />;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-6 py-5">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-20">
        <div className="flex w-full max-w-[420px] flex-col items-center gap-6 rounded-[20px] border border-line bg-panel p-8 text-center">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-3xl font-bold tracking-tight">Welcome to Degamed</h1>
            <p className="text-muted">Sign in to start making games.</p>
          </div>
          {isGoogleConfigured ? (
            <div ref={buttonRef} className="flex min-h-11 w-full justify-center" />
          ) : (
            <div className="w-full rounded-xl border border-[#4D3A12] bg-[#241C0E] p-4 text-left text-sm text-[#F5DFA8]">
              <strong className="block text-warn">Sign-in isn’t set up yet</strong>
              Add your Supabase and Google keys to <code className="font-mono">apps/web/.env.local</code>. The
              steps are in <code className="font-mono">docs/SETUP.md</code>.
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-bad">
              {error}
            </p>
          )}
          <p className="text-xs text-muted">By continuing you agree to the Terms and Privacy Policy.</p>
        </div>
      </main>
    </div>
  );
}
