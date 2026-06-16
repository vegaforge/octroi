'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';

const easeSmooth = [0.32, 0.72, 0, 1] as const;

export interface FeedEntry {
  /** Stable id (use the receipt nonce). */
  id: string;
  /** URL the crawler fetched. */
  url: string;
  /** Display string for the counterparty (truncated address or domain). */
  counterparty: string;
  /** Pre-formatted amount, e.g. "$0.0001". */
  amount: string;
  /** Relative timestamp, e.g. "2m". */
  timeAgo: string;
  /** Set when an entry first appears in a polling cycle. Drives the highlight. */
  fresh?: boolean;
}

type LiveFeedProps = {
  title: string;
  entries: FeedEntry[];
  loading?: boolean;
};

/** Props-driven receipts feed. Parent polls and marks new entries `fresh` for the highlight. */
export function LiveFeed({ title, entries, loading }: LiveFeedProps) {
  const reduced = useReducedMotion();

  return (
    <section className="rounded-card border border-border-subtle bg-bg-surface p-6">
      <header className="mb-4 flex items-center justify-between gap-4">
        <h3 className="text-base font-semibold">{title}</h3>
        <Chip variant="accent" dot="live">
          live
        </Chip>
      </header>

      {loading && entries.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-ink-tertiary">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        </div>
      ) : entries.length === 0 ? (
        <div className="py-10 text-center text-sm text-ink-tertiary">
          No receipts yet. They&rsquo;ll appear here as crawls happen.
        </div>
      ) : (
        <ul className="flex flex-col" role="list">
          <AnimatePresence initial={false}>
            {entries.map((entry) => (
              <motion.li
                key={entry.id}
                layout={!reduced}
                initial={
                  entry.fresh && !reduced
                    ? { height: 0, opacity: 0 }
                    : { opacity: 1, height: 'auto' }
                }
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: easeSmooth }}
                className="flex items-center gap-3 overflow-hidden border-b border-border-subtle py-3.5 last:border-b-0"
                style={
                  entry.fresh
                    ? { animation: 'fresh-row 800ms cubic-bezier(.32,.72,0,1)' }
                    : undefined
                }
              >
                <div className="min-w-0 flex-1">
                  <div className="mono truncate text-[12.5px] text-ink-primary">{entry.url}</div>
                  <div className="mono mt-0.5 text-[11px] text-ink-tertiary">
                    {entry.counterparty}
                  </div>
                </div>
                <div className="mono flex-none text-[13px] text-accent">{entry.amount}</div>
                <div className="w-12 flex-none text-right text-[11px] text-ink-tertiary">
                  {entry.timeAgo}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
