import { useState } from 'react';
import { Lock } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { loadKeys, maskKey, saveKey, type KeyProvider, type StoredKeys } from '../lib/keys';

const PROVIDERS: { id: KeyProvider; name: string; use: string; link: string; placeholder: string }[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    use: 'Chat (free tier); images need billing on the key',
    link: 'https://aistudio.google.com/apikey',
    placeholder: 'AIza…',
  },
  { id: 'anthropic', name: 'Anthropic', use: 'AI Copilot (best results)', link: 'https://console.anthropic.com/settings/keys', placeholder: 'sk-ant-…' },
  { id: 'openai', name: 'OpenAI', use: 'Images and chat', link: 'https://platform.openai.com/api-keys', placeholder: 'sk-…' },
  { id: 'openrouter', name: 'OpenRouter', use: 'Chat with many models', link: 'https://openrouter.ai/keys', placeholder: 'sk-or-…' },
];

export function Settings() {
  const [keys, setKeys] = useState<StoredKeys>(() => loadKeys());
  const [drafts, setDrafts] = useState<Partial<Record<KeyProvider, string>>>({});

  return (
    <AppShell>
      <h1 className="font-display text-3xl tracking-tight">Settings</h1>
      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Your AI keys</h2>
          <p className="text-sm text-muted">Use your own keys for free, unlimited AI. You pay your provider directly.</p>
        </div>
        {PROVIDERS.map((p) => {
          const saved = keys[p.id];
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-panel-2 p-4">
              <div className="flex flex-[0_0_180px] flex-col">
                <strong>{p.name}</strong>
                <span className="text-xs text-muted">{p.use}</span>
              </div>
              {saved ? (
                <>
                  <span className="font-mono text-sm text-ink-2">{maskKey(saved)}</span>
                  <span className="text-sm text-ok">Saved</span>
                  <button type="button" onClick={() => setKeys(saveKey(p.id, null))} className="ml-auto min-h-10 rounded-lg border border-line-strong px-3 text-sm hover:bg-panel">
                    Remove
                  </button>
                </>
              ) : (
                <form
                  className="flex min-w-0 flex-[1_1_320px] gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setKeys(saveKey(p.id, drafts[p.id] ?? ''));
                    setDrafts((d) => ({ ...d, [p.id]: '' }));
                  }}
                >
                  <label htmlFor={`key-${p.id}`} className="sr-only">
                    {p.name} API key
                  </label>
                  <input
                    id={`key-${p.id}`}
                    type="password"
                    autoComplete="off"
                    placeholder={p.placeholder}
                    value={drafts[p.id] ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                    className="min-w-0 flex-1 rounded-lg border border-line-strong bg-bg px-3 py-2 font-mono text-sm outline-none"
                  />
                  <button type="submit" disabled={!drafts[p.id]?.trim()} className="min-h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50">
                    Save
                  </button>
                  <a href={p.link} target="_blank" rel="noreferrer" className="self-center text-sm whitespace-nowrap text-brand-soft hover:text-white">
                    Get a key
                  </a>
                </form>
              )}
            </div>
          );
        })}
        <p className="flex items-start gap-2.5 rounded-xl border border-[#1E4D3D] bg-[#10241D] p-3.5 text-sm text-[#C8E9DB]">
          <Lock size={18} className="mt-0.5 shrink-0 text-ok" aria-hidden="true" />
          Keys are stored only in this browser and sent straight to the provider. They never reach Degamed’s servers.
        </p>
      </section>
    </AppShell>
  );
}
