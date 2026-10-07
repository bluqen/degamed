import { Link, NavLink } from 'react-router';
import { useAuth } from '../lib/auth';
import { ButtonLink } from './Button';
import { Logo } from './Logo';

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'text-white' : 'text-brand-soft hover:text-white';

export function SiteHeader() {
  const { session } = useAuth();
  return (
    <header className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-8 gap-y-3 px-6 py-5">
      <Logo />
      <nav className="flex flex-wrap gap-6 text-[15px]">
        <NavLink to="/explore" className={navClass}>
          Explore
        </NavLink>
        <NavLink to="/pricing" className={navClass}>
          Pricing
        </NavLink>
        <a href="https://github.com/bluqen/degamed" className="text-brand-soft hover:text-white">
          Docs
        </a>
      </nav>
      <div className="ml-auto flex items-center gap-3">
        {session ? (
          <ButtonLink to="/dashboard">Open dashboard</ButtonLink>
        ) : (
          <>
            <Link to="/login" className="px-4 py-2.5 text-[15px] text-brand-soft hover:text-white">
              Log in
            </Link>
            <ButtonLink to="/login">Start creating</ButtonLink>
          </>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[#1F222B]">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-6 px-6 py-7 text-sm text-muted">
        <span className="font-display font-bold text-ink">degamed</span>
        <Link to="/pricing" className="hover:text-white">
          Pricing
        </Link>
        <a href="https://github.com/bluqen/degamed" className="hover:text-white">
          GitHub
        </a>
        <span className="ml-auto">Made in Nigeria</span>
      </div>
    </footer>
  );
}
