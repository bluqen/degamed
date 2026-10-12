import { Link, NavLink } from 'react-router';
import { useAuth } from '../lib/auth';
import { ButtonLink, ThemeToggle, cx } from '../ui';
import { Logo } from './Logo';

const navClass = ({ isActive }: { isActive: boolean }) =>
  cx(
    'rounded-sm px-1 text-body font-medium transition-colors',
    isActive ? 'text-ink' : 'text-muted hover:text-ink',
  );

/** Marketing-site header: logo, a couple of links, appearance and one primary action. */
export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const { session } = useAuth();
  return (
    <header
      className={cx(
        'sticky top-0 z-40 border-b backdrop-blur-xl',
        overlay ? 'border-transparent bg-transparent' : 'border-line/60 bg-glass',
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-8 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Site" className="hidden items-center gap-6 md:flex">
          <NavLink to="/create" className={navClass}>
            Make a game
          </NavLink>
          <NavLink to="/pricing" className={navClass}>
            Pricing
          </NavLink>
          <a href="https://github.com/bluqen/degamed" className={navClass({ isActive: false })}>
            Docs
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {!session && (
            <Link
              to="/login"
              className="hidden h-10 items-center rounded-md px-3 text-body font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink sm:inline-flex"
            >
              Log in
            </Link>
          )}
          <ButtonLink to="/create">Start creating</ButtonLink>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-8 text-body-sm text-muted sm:px-6">
        <Logo size={22} />
        <Link to="/create" className="hover:text-ink">
          Make a game
        </Link>
        <Link to="/pricing" className="hover:text-ink">
          Pricing
        </Link>
        <a href="https://github.com/bluqen/degamed" className="hover:text-ink">
          GitHub
        </a>
        <span className="sm:ml-auto">Made in Nigeria</span>
      </div>
    </footer>
  );
}
