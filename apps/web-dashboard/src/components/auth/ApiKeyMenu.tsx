'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, KeyRound, LogOut } from 'lucide-react';
import { useApiKey } from '@/hooks/useApiKey';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

/**
 * API-key session widget for dashboard navs (skeleton / enter-key / masked-key states).
 * The key is the publisher's Bearer credential for mutations. Read-only views work without one.
 */
export function ApiKeyMenu() {
  const { apiKey, hydrated, setApiKey, clearApiKey } = useApiKey();
  const [open, setOpen] = useState(false);
  const [entering, setEntering] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!hydrated) {
    return <div className="h-9 w-32 animate-pulse rounded-lg bg-bg-elevated" aria-hidden />;
  }

  if (!apiKey) {
    if (entering) {
      return (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = draft.trim();
            if (!trimmed) return;
            setApiKey(trimmed);
            setDraft('');
            setEntering(false);
          }}
        >
          <input
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste API key"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="mono h-9 w-44 rounded-lg border border-border-subtle bg-bg-surface px-3 text-[13px] text-ink-primary placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
          />
          <Button type="submit" size="sm">
            Save
          </Button>
        </form>
      );
    }
    return (
      <Button size="sm" variant="secondary" onClick={() => setEntering(true)}>
        <KeyRound className="h-4 w-4" aria-hidden />
        Enter API key
      </Button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'mono inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-surface px-3 py-1.5 text-[13px] text-ink-secondary transition-colors',
          'hover:border-border-strong hover:text-ink-primary',
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <KeyRound className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} aria-hidden />
        <span>{mask(apiKey)}</span>
        <ChevronDown
          className={cn('h-3 w-3 transition-transform', open && 'rotate-180')}
          strokeWidth={1.5}
          aria-hidden
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              clearApiKey();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-secondary transition-colors hover:bg-bg-surface hover:text-ink-primary"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            Clear key
          </button>
        </div>
      )}
    </div>
  );
}

function mask(key: string): string {
  if (key.length <= 8) return key;
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
