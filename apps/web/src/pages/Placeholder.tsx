import { AppShell } from '../components/AppShell';
import { SiteFooter, SiteHeader } from '../components/SiteHeader';
import { ButtonLink } from '../components/Button';

export function ComingSoon({ title, body, shell = 'app' }: { title: string; body: string; shell?: 'app' | 'site' }) {
  const content = (
    <div className="flex flex-col gap-3">
      <h1 className="font-display text-3xl tracking-tight">{title}</h1>
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="font-mono text-cyan">404</span>
      <h1 className="font-display text-4xl">This level doesn’t exist</h1>
      <ButtonLink to="/">Back to the start</ButtonLink>
    </div>
  );
}
