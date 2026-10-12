import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Share2 } from 'lucide-react';
import { KITS } from '../lib/game';
import { shareUrl } from '../lib/share';
import { Button, Dialog, Input, buttonClass } from '../ui';
import type { Studio } from './useStudio';

export function ShareDialog({
  open,
  onClose,
  studio,
}: {
  open: boolean;
  onClose: () => void;
  studio: Studio;
}) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const { spec, title } = studio;
  useEffect(() => {
    if (!open || !spec) return setUrl(null);
    const kit = KITS.find((k) => k.id === spec.kit);
    const defaults = Object.fromEntries((kit?.params ?? []).map((p) => [p.key, p.default]));
    let live = true;
    void shareUrl({ ...spec, title }, defaults).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [open, spec, title]);
  const canNativeShare =
    typeof navigator !== 'undefined' &&
    'share' in navigator &&
    window.matchMedia('(pointer: coarse)').matches;
  const nativeShare = async () => {
    if (!url) return;
    try {
      await navigator.share({ title, text: `Play “${title}”, a game I made with Degamed`, url });
    } catch {
      // Cancelled.
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard blocked: select the text so Ctrl+C works.
      (document.getElementById('share-url') as HTMLInputElement | null)?.select();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Share “${studio.title}”`}
      description={
        spec
          ? 'Anyone with the link can play it on a phone or a computer. No account needed.'
          : undefined
      }
      footer={
        spec ? (
          <>
            <a
              href={url ?? undefined}
              target="_blank"
              rel="noreferrer"
              className={buttonClass({ variant: 'secondary' })}
            >
              <ExternalLink size={16} aria-hidden="true" /> Open
            </a>
            {canNativeShare && (
              <Button
                variant="secondary"
                icon={<Share2 size={16} />}
                onClick={() => void nativeShare()}
              >
                Share…
              </Button>
            )}
            <Button
              onClick={() => void copy()}
              icon={copied ? <Check size={16} /> : <Copy size={16} />}
            >
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>OK</Button>
        )
      }
    >
      {spec ? (
        <div className="flex flex-col gap-3">
          <label htmlFor="share-url" className="text-body-sm font-semibold">
            Link
          </label>
          <Input
            id="share-url"
            readOnly
            value={url ?? 'Making your link…'}
            onFocus={(e) => e.currentTarget.select()}
            className="font-mono text-body-sm"
          />
          <p className="text-body-sm text-muted">
            The link rebuilds the game from its recipe, so changes you made in Advanced aren’t
            included yet.
          </p>
        </div>
      ) : (
        <p className="text-body text-muted">
          This game was built by hand in Advanced, so it can’t be shared as a link yet. Publishing
          hand-made games is coming soon.
        </p>
      )}
    </Dialog>
  );
}
