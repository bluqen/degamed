import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { LogoMark } from '../components/Logo';
import { NeonCityScene } from '../components/GameArt';
import { getProject, type ProjectRow } from '../lib/projects';
import { isAuthConfigured } from '../lib/env';

/**
 * Editor placeholder. The real editor (engine, AI Copilot, Pro panels) lands in milestones 2–5;
 * this screen already loads the project so routing and permissions are exercised end to end.
 */
export function Editor() {
  const { id } = useParams();
  const [project, setProject] = useState<ProjectRow | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !isAuthConfigured) return;
    getProject(id)
      .then(setProject)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load project'));
  }, [id]);

  return (
    <div className="flex min-h-screen flex-col text-sm">
      <header className="flex h-13 flex-wrap items-center gap-3.5 border-b border-[#1F222B] bg-sunken px-4">
        <Link to="/dashboard" aria-label="Back to dashboard" className="flex">
          <LogoMark size={22} hole="#121419" />
        </Link>
        <strong className="text-[15px]">{project?.title ?? 'Loading…'}</strong>
        <div role="group" aria-label="Editor mode" className="mx-auto inline-flex rounded-[10px] border border-line bg-bg p-[3px]">
          <span className="rounded-[7px] bg-brand px-3.5 py-1.5 font-semibold text-white">Simple</span>
          <span className="px-3.5 py-1.5 text-muted">Pro</span>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-[#0A0B0F] p-6 text-center">
        {error && (
          <p role="alert" className="text-bad">
            {error}
          </p>
        )}
        {project === null && <p className="text-muted">This project doesn’t exist or you don’t have access.</p>}
        <div className="w-full max-w-[720px] overflow-hidden rounded-xl border border-line">
          <NeonCityScene title="Preview of the game view" />
        </div>
        <div className="flex max-w-[560px] flex-col gap-2">
          <h1 className="font-display text-2xl">The editor is being built</h1>
          <p className="text-muted">
            Your project is saved. The game engine, AI Copilot and Pro editor are the next milestones on the
            roadmap.
          </p>
        </div>
      </main>
    </div>
  );
}
