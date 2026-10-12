import { AppShell } from '../components/AppShell';
import { SiteFooter, SiteHeader } from '../components/SiteHeader';
import { ButtonLink } from '../ui';

export function ComingSoon({
  title,
  body,
  shell = 'app',
}: {
  title: string;
  body: string;
  shell?: 'app' | 'site';
}) {
  const content = (
    <div className="flex flex-col gap-3">
      <h1 className="font-display text-title-lg font-bold tracking-[-0.02em]">{title}</h1>
      <p className="max-w-[560px] text-muted">{body}</p>
    </div>
  );
  if (shell === 'app') return <AppShell>{content}</AppShell>;
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 py-14">{content}</main>
      <SiteFooter />
    </div>
  );
}

export function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="font-mono text-body-sm font-semibold text-brand-ink">404</span>
      <h1 className="font-display text-title-lg font-bold tracking-[-0.02em]">
        This level doesn’t exist
      </h1>
      <p className="max-w-sm text-body text-muted">
        The link may be old or mistyped. Why not make a game instead?
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <ButtonLink to="/" variant="secondary">
          Home
        </ButtonLink>
        <ButtonLink to="/create">Make a game</ButtonLink>
      </div>
    </div>
  );
}
