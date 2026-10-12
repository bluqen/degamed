import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { LogoMark } from '../components/Logo';
import { Button, buttonClass } from '../ui';

/**
 * Shown when a page fails to load or crashes. One broken module must never leave a blank
 * white screen: this keeps the brand, explains plainly, and offers a way forward.
 */
export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  if (import.meta.env.DEV) console.error(error);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-bg px-6 text-center text-ink">
      <LogoMark size={36} />
      <span className="flex size-12 items-center justify-center rounded-full bg-bad-tint text-bad">
        <TriangleAlert size={22} aria-hidden="true" />
      </span>
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="text-title-lg font-bold tracking-[-0.02em]">
          {notFound ? 'This page doesn’t exist' : 'Something went wrong'}
        </h1>
        <p className="text-body text-muted">
          {notFound
            ? 'The link may be old or mistyped.'
            : 'This page hit a problem while loading. Your games are safe on this device. Reloading usually fixes it.'}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Link to="/create" className={buttonClass({ variant: 'secondary' })}>
          Your games
        </Link>
        {!notFound && (
          <Button icon={<RotateCcw size={16} />} onClick={() => window.location.reload()}>
            Reload
          </Button>
        )}
      </div>
    </div>
  );
}
