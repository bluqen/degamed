import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'degamed.theme';

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

/** Applies a resolved theme to <html> without animating every surface. */
function apply(dark: boolean) {
  const root = document.documentElement;
  const next = dark ? 'dark' : 'light';
  if (root.getAttribute('data-theme') === next) return;
  root.classList.add('theme-switching');
  root.setAttribute('data-theme', next);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => root.classList.remove('theme-switching')),
  );
}

interface ThemeCtx {
  pref: ThemePref;
  resolved: 'light' | 'dark';
  setPref: (p: ThemePref) => void;
}

const Ctx = createContext<ThemeCtx>({ pref: 'system', resolved: 'light', setPref: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(readPref);
  const [sys, setSys] = useState(systemDark);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setSys(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const dark = pref === 'dark' || (pref === 'system' && sys);
  useEffect(() => apply(dark), [dark]);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    try {
      if (p === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, p);
    } catch {
      // Storage blocked: the choice lasts for this visit.
    }
  }, []);

  return (
    <Ctx.Provider value={{ pref, resolved: dark ? 'dark' : 'light', setPref }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
