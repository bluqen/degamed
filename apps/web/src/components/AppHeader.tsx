import type { ReactNode } from 'react';
import { Settings } from 'lucide-react';
import { Link } from 'react-router';
import { ThemeToggle, Tooltip, cx } from '../ui';
import { Logo } from './Logo';

/** The slim header used inside the app (Create, Play). */
export function AppHeader({ children, right, className }: { children?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <header className={cx('sticky top-0 z-40 border-b border-line/70 bg-glass backdrop-blur-xl', className)}>
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-4 sm:px-6">
        <Logo />
        {children}
        <div className="ml-auto flex items-center gap-1.5">
          {right}
          <ThemeToggle />
          <Tooltip label="Settings">
            <Link to="/settings" aria-label="Settings" className="inline-flex size-10 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
              <Settings size={18} />
            </Link>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
