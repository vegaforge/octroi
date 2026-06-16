'use client';

import { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';

export type LogEntry =
  | { ts: string; kind: 'success'; pub: string; amount: string; tx: string; ms: number }
  | { ts: string; kind: 'fail'; pub: string; amount: string }
  | { ts: string; kind: 'done'; totalUnits: number };

type DemoTerminalProps = {
  logs: LogEntry[];
  idle: boolean;
};

/** Streaming log, auto-scrolls to bottom. Uses `whitespace-pre` so padEnd() alignment survives. */
export function DemoTerminal({ logs, idle }: DemoTerminalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs.length]);

  return (
    <section className="mb-6 overflow-hidden rounded-modal border border-border-subtle bg-[#0B1015]">
      <header className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
        <div className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        </div>
        <span className="mono ml-1.5 text-[12px] text-ink-tertiary">
          crawlpay demo · stellar-testnet
        </span>
      </header>
      <div ref={ref} className="mono h-[440px] overflow-y-auto px-4 py-4 text-[13px] leading-[1.9]">
        {idle && logs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2.5 text-center text-ink-tertiary">
            <Terminal className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            <span>
              Press{' '}
              <span className="mono rounded border border-border-subtle bg-bg-elevated px-1.5 py-0.5 text-[12px] text-ink-secondary">
                Run the demo
              </span>{' '}
              to stream 60 paid crawls.
            </span>
          </div>
        ) : (
          logs.map((l, i) => <LogLine key={i} entry={l} />)
        )}
      </div>
    </section>
  );
}

function LogLine({ entry }: { entry: LogEntry }) {
  if (entry.kind === 'success') {
    return (
      <div className="whitespace-pre text-ink-secondary">
        <span className="text-ink-tertiary">[{entry.ts}]</span>
        {'  '}
        <span className="text-sage">✓</span>
        {'  '}
        <span className="text-ink-primary">{entry.pub.padEnd(22)}</span>
        <span className="text-accent">{entry.amount}</span>
        {'  →  '}
        {entry.amount.slice(1)} USDC{'  →  '}
        <a
          className="text-steel underline underline-offset-2"
          href="#"
          onClick={(e) => e.preventDefault()}
        >
          stellar.expert/tx/{entry.tx}
        </a>
        {'  ·  '}
        <span className="text-ink-tertiary">{entry.ms}ms</span>
      </div>
    );
  }
  if (entry.kind === 'fail') {
    return (
      <div className="whitespace-pre text-ink-secondary">
        <span className="text-ink-tertiary">[{entry.ts}]</span>
        {'  '}
        <span className="text-[color:var(--warning)]">✗</span>
        {'  '}
        <span className="text-ink-primary">{entry.pub.padEnd(22)}</span>
        <span className="text-accent">{entry.amount}</span>
        {'  →  '}
        <span className="text-[color:var(--warning)]">retry_offer</span>
        {'  ·  attempt 1 of 3'}
      </div>
    );
  }
  return (
    <div className="text-sage">
      ✓ done · 60 / 60 settled · ${(entry.totalUnits * 0.0001).toFixed(4)} total · 5 / 5 publishers
    </div>
  );
}
