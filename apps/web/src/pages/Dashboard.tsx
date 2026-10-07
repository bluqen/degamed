import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Plus } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { ButtonLink } from '../components/Button';
import { useAuth } from '../lib/auth';
import { isAuthConfigured } from '../lib/env';
import { listMyProjects, timeAgo, type ProjectRow } from '../lib/projects';

function greeting(hour = new Date().getHours()) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function Dashboard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [idea, setIdea] = useState('');
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthConfigured) return;
    listMyProjects()
      .then(setProjects)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load projects'));
  }, []);

  const firstName = (session?.user.user_metadata?.full_name as string | undefined)?.split(' ')[0];

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    navigate(idea.trim() ? `/new?idea=${encodeURIComponent(idea.trim())}` : '/new');
  };

  return (
    <AppShell>
      <h1 className="font-display text-3xl tracking-tight">
        {greeting()}
        {firstName ? `, ${firstName}` : ''}
      </h1>

      <section className="flex flex-col gap-4 rounded-[18px] border border-line bg-panel p-6">
        <h2 className="text-lg font-semibold">Start something new</h2>
        <form onSubmit={onCreate} className="flex gap-2 rounded-2xl border border-line-strong bg-bg p-1.5">
          <label htmlFor="dash-idea" className="sr-only">
            Describe a game
          </label>
          <input
            id="dash-idea"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Describe a game… e.g. a cozy fishing game on a floating island"
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-white outline-none placeholder:text-muted"
          />
          <button type="submit" className="min-h-11 rounded-[10px] bg-brand px-5 font-semibold text-white hover:bg-[#5A3DF0]">
            Create
          </button>
        </form>
      </section>

      {!isAuthConfigured && (
        <div className="rounded-xl border border-[#4D3A12] bg-[#241C0E] p-4 text-sm text-[#F5DFA8]">
          Projects are saved to Supabase, which isn’t connected yet. Follow <code className="font-mono">docs/SETUP.md</code>{' '}
          step 1.
        </div>
      )}

      <section className="flex flex-col gap-3.5">
        <h2 className="text-lg font-semibold">Recent projects</h2>
        {error && (
          <p role="alert" className="text-bad">
            {error}
          </p>
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3.5">
          {projects?.map((p) => (
            <Link
              key={p.id}
              to={`/editor/${p.id}`}
              className="flex flex-col overflow-hidden rounded-[14px] border border-line bg-panel hover:border-line-strong"
            >
              <div className="aspect-video bg-[linear-gradient(180deg,#140830,#4A1670_60%,#FF5CA8)]" />
              <div className="flex flex-col gap-1 px-3.5 py-3">
                <strong className="truncate">{p.title}</strong>
                <span className="text-[13px] text-muted">
                  {p.language === 'python' ? 'Python' : 'JavaScript'} · edited {timeAgo(p.updated_at)} ·{' '}
                  {p.visibility[0]!.toUpperCase() + p.visibility.slice(1)}
                </span>
              </div>
            </Link>
          ))}
          <Link
            to="/new"
            className="flex min-h-[190px] flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-[#3A3F50] text-muted hover:text-white"
          >
            <Plus size={28} aria-hidden="true" />
            New game
          </Link>
        </div>
        {projects?.length === 0 && <p className="text-muted">No games yet. Describe one above to get started.</p>}
      </section>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3.5">
        <div className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-panel p-4.5">
          <h2 className="font-semibold">Use your own AI key</h2>
          <p className="text-sm text-muted">Free and unlimited. Your key stays in this browser.</p>
          <ButtonLink to="/settings" variant="outline" className="self-start">
            Add a key
          </ButtonLink>
        </div>
      </section>
    </AppShell>
  );
}
