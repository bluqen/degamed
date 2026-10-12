import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Gamepad2, Maximize2, Shuffle } from 'lucide-react';
import type { ProjectFiles } from '@degamed/shared';
import { LogoMark } from '../components/Logo';
import { Stage } from '../components/Stage';
import { buildGame, encode, readSpec, themes, type GameSpec } from '../lib/game';
import { themePreview } from '../lib/game/preview';
import { decodeSpec } from '../lib/share';
import { newGameId, saveGame } from '../lib/library';
import { loadForStudio } from '../studio/useStudio';
import { Button, ButtonLink, EmptyState } from '../ui';

/**
 * A clean place to just play: /play/:id for games on this device, /p/:code for shared links
 * (the code is the game's recipe, rebuilt here).
 */
export function PlayPage() {
  const { id, code } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<{ files: ProjectFiles; title: string; spec: GameSpec | null } | null | 'missing'>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (code) {
        const spec = decodeSpec(code);
        if (!spec) return setGame('missing');
        setGame({ files: buildGame(spec, encode), title: spec.title, spec });
      } else if (id) {
        const s = loadForStudio(id);
        setGame(s.status === 'ready' ? { files: s.files, title: s.title, spec: readSpec(s.files) } : 'missing');
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [id, code]);

  const theme = useMemo(() => (game && game !== 'missing' && game.spec ? themes().find((t) => t.id === game.spec!.theme) : undefined), [game]);
  const poster = useMemo(() => (theme ? themePreview(theme, 480, 270) : undefined), [theme]);

  useEffect(() => {
    if (game && game !== 'missing') document.title = `${game.title} · Play on Degamed`;
  }, [game]);

  const remix = () => {
    if (!game || game === 'missing' || !game.spec) return;
    const newId = newGameId();
    saveGame({ id: newId, title: `${game.title} (remix)`, prompt: game.spec.story ?? '', kit: game.spec.kit, theme: game.spec.theme }, game.files);
    navigate(`/editor/${newId}`);
  };

  return (
    <div data-theme="dark" className="flex min-h-dvh flex-col bg-stage text-ink">
      <header className="flex h-14 shrink-0 items-center gap-3 px-3 sm:px-5">
        {id ? (
          <Link to={`/editor/${id}`} className="flex h-10 items-center gap-2 rounded-md px-2 text-body-sm font-semibold text-ink-2 hover:bg-white/10 hover:text-ink">
            <ArrowLeft size={18} aria-hidden="true" /> Back to editing
          </Link>
        ) : (
          <Link to="/" aria-label="Degamed home" className="flex h-10 items-center rounded-md px-2 hover:bg-white/10">
            <LogoMark size={24} hole="var(--c-stage)" />
          </Link>
        )}
        <h1 className="min-w-0 truncate text-body font-semibold">{game && game !== 'missing' ? game.title : ''}</h1>
        <div className="ml-auto flex items-center gap-2">
          {code && game && game !== 'missing' && (
            <Button variant="ghost" icon={<Shuffle size={16} />} onClick={remix} className="max-sm:hidden">
              Remix
            </Button>
          )}
          {!id && <ButtonLink to="/create">Make your own</ButtonLink>}
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center p-0 sm:p-6">
        {game === 'missing' ? (
          <EmptyState icon={<Gamepad2 size={22} />} title="This game couldn’t be opened" body="The link may be incomplete, or the game was made on another device." action={<ButtonLink to="/create">Make a game</ButtonLink>} />
        ) : game ? (
          <div className="w-full max-w-[min(100%,calc((100dvh-56px-64px)*16/9))]">
            <Stage files={game.files} title={game.title} poster={poster} className="max-sm:rounded-none" />
            <p className="mt-3 flex items-center justify-center gap-2 text-body-sm text-muted">
              <Maximize2 size={14} aria-hidden="true" /> Arrow keys to move, Space to jump. On a phone, use the on-screen buttons.
            </p>
          </div>
        ) : (
          <div className="skeleton aspect-video w-full max-w-[min(100%,calc((100dvh-56px-64px)*16/9))] rounded-xl" />
        )}
      </main>
    </div>
  );
}
