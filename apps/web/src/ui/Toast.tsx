import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { cx } from './cx';

type Tone = 'info' | 'success' | 'error';
interface ToastItem {
  id: number;
  tone: Tone;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
}

type Push = (t: Omit<ToastItem, 'id'> & { duration?: number }) => void;
const Ctx = createContext<Push>(() => {});

/** Short-lived notifications, announced politely to screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(0);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback<Push>(
    ({ duration = 4000, ...t }) => {
      const id = ++next.current;
      setItems((l) => [...l.slice(-2), { ...t, id }]);
      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );
  return (
    <Ctx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[300] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-md animate-rise items-start gap-3 rounded-lg border border-line bg-surface py-3 pr-2 pl-4 text-ink shadow-3"
          >
            <span
              className={cx(
                'mt-0.5 shrink-0',
                t.tone === 'success'
                  ? 'text-ok'
                  : t.tone === 'error'
                    ? 'text-bad'
                    : 'text-brand-ink',
              )}
            >
              {t.tone === 'success' ? (
                <CheckCircle2 size={18} />
              ) : t.tone === 'error' ? (
                <TriangleAlert size={18} />
              ) : (
                <Info size={18} />
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <strong className="text-body font-semibold">{t.title}</strong>
              {t.body && <span className="text-body-sm text-muted">{t.body}</span>}
            </div>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
                className="h-8 shrink-0 rounded-sm px-2.5 text-body-sm font-semibold text-brand-ink hover:bg-brand-tint"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="flex size-8 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-surface-2 hover:text-ink"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
