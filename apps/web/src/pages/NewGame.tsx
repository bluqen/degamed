import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { ArtStyle, ScriptLanguage } from '@degamed/shared';
import { Button } from '../components/Button';
import { createProject } from '../lib/projects';
import { isAuthConfigured } from '../lib/env';
import { titleFromIdea } from '../lib/titles';

const STEPS = ['Idea', 'Style', 'Setup'] as const;

const STYLES: { id: ArtStyle; name: string; bg: string }[] = [
  { id: 'neon', name: 'Neon Glow', bg: 'linear-gradient(180deg,#140830,#4A1670 60%,#FF5CA8)' },
  { id: 'pastel', name: 'Pastel Soft', bg: 'linear-gradient(180deg,#FFE3EC,#D7F2E9)' },
  { id: 'paper', name: 'Paper Cutout', bg: 'linear-gradient(180deg,#F6E7C8,#E3B587)' },
  { id: 'flat', name: 'Flat Geometric', bg: 'linear-gradient(135deg,#1D3557 50%,#E63946 50%)' },
  { id: 'ink', name: 'Ink Wash', bg: 'radial-gradient(circle at 70% 35%,#D94F3D 18%,#F3EBDD 19%)' },
  { id: 'retro', name: 'Retro Vector', bg: 'linear-gradient(180deg,#05060F,#1B1F4B)' },
];

export function NewGame() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [idea, setIdea] = useState(params.get('idea') ?? '');
  const [style, setStyle] = useState<ArtStyle>('neon');
  const [language, setLanguage] = useState<ScriptLanguage>('python');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const project = await createProject({ title: titleFromIdea(idea), description: idea.trim(), artStyle: style, language });
      navigate(`/editor/${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the project');
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center gap-5 border-b border-[#1F222B] px-7 py-4">
        <Link to="/dashboard" className="text-ink-2 hover:text-white">
          ← Back
        </Link>
        <strong className="font-display text-lg">New game</strong>
        <ol className="ml-auto flex flex-wrap gap-2 text-sm">
          {STEPS.map((label, i) => (
            <li
              key={label}
              aria-current={i === step ? 'step' : undefined}
              className={`rounded-full px-3 py-1.5 ${i === step ? 'bg-brand text-white' : i < step ? 'bg-[#1F2230] text-brand-soft' : 'border border-line-strong text-muted'}`}
            >
              {i + 1} {label}
            </li>
          ))}
        </ol>
      </header>

      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-6 px-7 py-9">
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <h1 className="font-display text-4xl tracking-tight">What do you want to make?</h1>
            <label htmlFor="idea" className="text-muted">
              Describe the game, the player, the goal and the vibe.
            </label>
            <textarea
              id="idea"
              rows={5}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="A neon cyberpunk platformer where a cat hacks drones to steal data cores…"
              className="resize-y rounded-[14px] border border-line-strong bg-panel p-4 text-[17px] leading-normal text-white outline-none placeholder:text-muted"
            />
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <h1 className="font-display text-4xl tracking-tight">Pick an art style</h1>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={style === s.id}
                  onClick={() => setStyle(s.id)}
                  className={`flex flex-col overflow-hidden rounded-[14px] border-2 bg-panel text-left ${style === s.id ? 'border-cyan' : 'border-line'}`}
                >
                  <span className="block h-24" style={{ background: s.bg }} />
                  <span className="px-3 py-2.5">{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-5">
            <h1 className="font-display text-4xl tracking-tight">A few settings</h1>
            <fieldset className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-panel p-4.5">
              <legend className="px-1.5 text-muted">Script language</legend>
              {(['python', 'javascript'] as const).map((l) => (
                <label key={l} className="flex items-center gap-2.5">
                  <input type="radio" name="lang" checked={language === l} onChange={() => setLanguage(l)} />
                  {l === 'python' ? 'Python' : 'JavaScript'}
                </label>
              ))}
              <span className="text-[13px] text-muted">You can mix both in one game later.</span>
            </fieldset>
            {!isAuthConfigured && (
              <p className="rounded-xl border border-[#4D3A12] bg-[#241C0E] p-4 text-sm text-[#F5DFA8]">
                Saving projects needs Supabase. See <code className="font-mono">docs/SETUP.md</code>.
              </p>
            )}
            {error && (
              <p role="alert" className="text-bad">
                {error}
              </p>
            )}
          </div>
        )}

        <div className="mt-auto flex justify-end gap-2.5 border-t border-[#1F222B] pt-3">
          <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)}>Next</Button>
          ) : (
            <Button onClick={create} disabled={busy || !isAuthConfigured}>
              {busy ? 'Creating…' : 'Create game'}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
