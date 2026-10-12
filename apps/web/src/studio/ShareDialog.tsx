import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { shareUrl } from '../lib/share';
import { Button, Dialog, Input, buttonClass } from '../ui';
import type { Studio } from './useStudio';

export function ShareDialog({ open, onClose, studio }: { open: boolean; onClose: () => void; studio: Studio }) {
  const [copied, setCopied] = useState(false);
  const url = studio.spec ? shareUrl({ ...studio.spec, title: studio.title }) : null;

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
      description={url ? 'Anyone with the link can play it on a phone or a computer. No account needed.' : undefined}
      footer={
        url ? (
          <>
            <a href={url} target="_blank" rel="noreferrer" className={buttonClass({ variant: 'secondary' })}>
              <ExternalLink size={16} aria-hidden="true" /> Open
            </a>
            <Button onClick={() => void copy()} icon={copied ? <Check size={16} /> : <Copy size={16} />}>
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>OK</Button>
        )
      }
    >
      {url ? (
        <div className="flex flex-col gap-3">
          <label htmlFor="share-url" className="text-body-sm font-semibold">
            Link
          </label>
          <Input id="share-url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-body-sm" />
          <p className="text-body-sm text-muted">The link rebuilds the game from its recipe, so changes you made in Advanced aren’t included yet.</p>
        </div>
      ) : (
        <p className="text-body text-muted">This game was built by hand in Advanced, so it can’t be shared as a link yet. Publishing hand-made games is coming soon.</p>
      )}
    </Dialog>
  );
}
