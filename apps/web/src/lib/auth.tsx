import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isAuthConfigured } from './env';

interface AuthState {
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  session: null,
  loading: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isAuthConfigured);

  // The Supabase client is big; load it after first paint, and only when sign-in is set up.
  useEffect(() => {
    if (!isAuthConfigured) return;
    let unsubscribe = () => {};
    let live = true;
    void import('./supabase').then(({ supabase }) => {
      if (!supabase || !live) return;
      supabase.auth.getSession().then(({ data }) => {
        setSession(data.session);
        setLoading(false);
      });
      const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
      unsubscribe = () => data.subscription.unsubscribe();
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const { supabase } = await import('./supabase');
    await supabase?.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, loading, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
