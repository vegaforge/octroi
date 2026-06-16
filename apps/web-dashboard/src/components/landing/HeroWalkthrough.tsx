'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { Bot, Check, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

const easeSmooth = [0.32, 0.72, 0, 1] as const;

type GateState = 'idle' | 'check' | 'locked' | 'pay' | 'settle' | 'open';
type ContentState = 'locked' | 'unlocked';
type TokenPos = 'crawler' | 'gate' | 'publisher';
type TokenVariant = 'plain' | 'warn' | 'pay' | 'ok';

interface SubStep {
  step: 1 | 2 | 3 | 4 | 5;
  /** First or second beat within the step. */
  beat: 'a' | 'b';
  caption: React.ReactNode;
  token: { text: string; at: TokenPos; variant: TokenVariant } | null;
  gate: GateState;
  content: ContentState;
  batch?: string;
}

const STEP_NAMES = ['Request', 'Paywall', 'Pay', 'Settle', 'Access'] as const;

const POS: Record<TokenPos, string> = {
  crawler: '16%',
  gate: '50%',
  publisher: '84%',
};

// 5 steps, 2 beats each
const SUBSTEPS: SubStep[] = [
  {
    step: 1,
    beat: 'a',
    caption: (
      <>
        Crawler sends <b>GET /article</b> to the publisher
      </>
    ),
    token: { text: 'GET /article', at: 'crawler', variant: 'plain' },
    gate: 'idle',
    content: 'locked',
  },
  {
    step: 1,
    beat: 'b',
    caption: (
      <>
        The request reaches the publisher&rsquo;s <b>CrawlPay paygate</b>
      </>
    ),
    token: { text: 'GET /article', at: 'gate', variant: 'plain' },
    gate: 'idle',
    content: 'locked',
  },
  {
    step: 2,
    beat: 'a',
    caption: (
      <>
        A built-in classifier flags the caller as a <b>bot, not a human</b>
      </>
    ),
    token: { text: 'classify · bot', at: 'gate', variant: 'warn' },
    gate: 'check',
    content: 'locked',
  },
  {
    step: 2,
    beat: 'b',
    caption: (
      <>
        The paygate answers <b>402</b> with a signed price offer · <b>$0.0001</b>
      </>
    ),
    token: { text: '402 · $0.0001', at: 'crawler', variant: 'warn' },
    gate: 'locked',
    content: 'locked',
  },
  {
    step: 3,
    beat: 'a',
    caption: (
      <>
        Crawler signs a <b>Soroban authorization entry</b>, off-chain, <b>no gas</b>
      </>
    ),
    token: { text: 'sign auth entry', at: 'crawler', variant: 'pay' },
    gate: 'locked',
    content: 'locked',
  },
  {
    step: 3,
    beat: 'b',
    caption: (
      <>
        It sends the <b>signed USDC</b> payment back to the paygate
      </>
    ),
    token: { text: '$0.0001 signed', at: 'gate', variant: 'pay' },
    gate: 'pay',
    content: 'locked',
  },
  {
    step: 4,
    beat: 'a',
    caption: (
      <>
        An <b>MPP session</b> batches thousands of debits together
      </>
    ),
    token: null,
    gate: 'settle',
    content: 'locked',
    batch: 'MPP session · batching',
  },
  {
    step: 4,
    beat: 'b',
    caption: (
      <>
        <b>Soroban</b> settles the batch in one transaction, with the facilitator sponsoring the fee
      </>
    ),
    token: null,
    gate: 'settle',
    content: 'locked',
    batch: 'Soroban · settled',
  },
  {
    step: 5,
    beat: 'a',
    caption: (
      <>
        <b>200 OK</b>, and the content unlocks for the crawler
      </>
    ),
    token: { text: '200 OK', at: 'gate', variant: 'ok' },
    gate: 'open',
    content: 'unlocked',
  },
  {
    step: 5,
    beat: 'b',
    caption: (
      <>
        A <b>portable signed receipt</b> is issued, verifiable with no database
      </>
    ),
    token: { text: '✓ receipt', at: 'crawler', variant: 'ok' },
    gate: 'open',
    content: 'unlocked',
  },
];

// visual mapping helpers

function gateFilter(state: GateState): string {
  switch (state) {
    case 'locked':
      return 'saturate(0.6) brightness(0.82)';
    case 'settle':
    case 'open':
      return 'drop-shadow(0 0 14px var(--accent-glow))';
    default:
      return 'none';
  }
}

function gateGlowOpacity(state: GateState): number {
  if (state === 'pay') return 0.7;
  if (state === 'settle' || state === 'open') return 1;
  return 0;
}

function tokenColors(variant: TokenVariant) {
  switch (variant) {
    case 'warn':
      return {
        bg: 'var(--bg-elevated)',
        border: 'var(--accent)',
        color: 'var(--accent)',
      };
    case 'pay':
      return {
        bg: 'var(--accent-subtle)',
        border: 'var(--accent)',
        color: 'var(--accent)',
      };
    case 'ok':
      return {
        bg: 'var(--bg-elevated)',
        border: 'var(--success)',
        color: 'var(--success)',
      };
    default:
      return {
        bg: 'var(--bg-elevated)',
        border: 'var(--border-strong)',
        color: 'var(--text-primary)',
      };
  }
}

export function HeroWalkthrough() {
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: true, amount: 0.25 });
  const [index, setIndex] = useState(0);

  // auto-advance once visible, looping. reduced-motion holds on the first (complete) frame
  useEffect(() => {
    if (!inView || reduced) return;
    const isLast = index === SUBSTEPS.length - 1;
    const id = window.setTimeout(
      () => setIndex((i) => (i + 1) % SUBSTEPS.length),
      isLast ? 2500 : 1850,
    );
    return () => window.clearTimeout(id);
  }, [index, inView, reduced]);

  const current = SUBSTEPS[index]!;

  return (
    <div ref={containerRef} className="w-full max-w-[900px]">
      <div className="mb-4 flex items-center justify-between gap-4">
        <span className="mono inline-flex items-center gap-2 text-xs text-ink-secondary">
          <span className="live-dot" aria-hidden />
          How a paid crawl works
        </span>
        <span className="mono text-xs font-semibold text-accent">
          {STEP_NAMES[current.step - 1]}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
        {([1, 2, 3, 4, 5] as const).map((s) => {
          const done = s < current.step;
          const active = s === current.step;
          const fillScale = done ? 1 : active ? (current.beat === 'a' ? 0.5 : 1) : 0;
          return (
            <div key={s} className="flex flex-col gap-2 sm:gap-2.5">
              <div className="relative h-[3px] overflow-hidden rounded-sm bg-border-subtle">
                <motion.div
                  className="h-full origin-left bg-accent"
                  animate={{ scaleX: fillScale }}
                  transition={{ duration: 0.45, ease: easeSmooth }}
                />
              </div>
              <div className="flex items-center gap-2 text-[11.5px] font-medium">
                <span
                  className={cn(
                    'h-2 w-2 flex-none rounded-full border transition-all',
                    done || active
                      ? 'border-accent bg-accent shadow-[0_0_0_3px_var(--accent-subtle)]'
                      : 'border-border-strong bg-transparent',
                  )}
                />
                <span
                  className={cn(
                    'truncate',
                    done || active ? 'text-ink-primary' : 'text-ink-tertiary',
                  )}
                >
                  <span className="hidden sm:inline">{STEP_NAMES[s - 1]}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="relative mt-5 h-[200px] sm:h-[230px]"
        role="img"
        aria-label="Animated walkthrough of a paid crawl"
      >
        <div
          className="absolute left-[16%] right-[16%] top-[54%] h-0.5 -translate-y-1/2"
          style={{
            background:
              'repeating-linear-gradient(90deg, var(--border-strong) 0 6px, transparent 6px 13px)',
          }}
          aria-hidden
        />

        <Station label="AI crawler" left="16%">
          <div
            className="flex h-13 w-13 items-center justify-center rounded-2xl border bg-bg-elevated shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
            style={{ borderColor: 'var(--secondary)', height: 52, width: 52 }}
          >
            <Bot
              className="h-[26px] w-[26px]"
              style={{ color: 'var(--secondary)' }}
              strokeWidth={1.5}
            />
          </div>
        </Station>

        <Station label="CrawlPay paygate" left="50%">
          <motion.div
            className="relative flex h-[94px] items-center justify-center text-accent"
            animate={{ filter: gateFilter(current.gate) }}
            transition={{ duration: 0.4, ease: easeSmooth }}
          >
            <motion.div
              className="absolute left-1/2 top-[42%] h-[52px] w-[52px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background: 'radial-gradient(circle, var(--accent-glow), transparent 70%)',
              }}
              animate={{ opacity: gateGlowOpacity(current.gate) }}
              transition={{ duration: 0.4, ease: easeSmooth }}
              aria-hidden
            />
            <svg viewBox="0 0 64 64" className="h-[94px] w-auto" aria-hidden>
              <path
                fill="currentColor"
                d="M8 56V32a24 24 0 0 1 48 0v24h-10V32a14 14 0 0 0-28 0v24Z"
              />
              <ellipse fill="currentColor" cx="32" cy="29.5" rx="3.2" ry="3.8" />
            </svg>
            <AnimatePresence>
              {(current.gate === 'check' || current.gate === 'locked') && (
                <motion.div
                  key="lockbadge"
                  className="absolute left-1/2 top-[52%] flex h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-ink-secondary"
                  style={{
                    background: 'var(--bg-base)',
                    borderColor: 'var(--border-strong)',
                  }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.25 }}
                >
                  <Lock className="h-3 w-3" strokeWidth={1.5} aria-hidden />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </Station>

        <Station label="Publisher" left="84%">
          <motion.div
            className="relative flex w-[62px] flex-col gap-1.5 rounded-lg border bg-bg-elevated p-[11px_10px]"
            animate={{
              opacity: current.content === 'unlocked' ? 1 : 0.5,
              borderColor:
                current.content === 'unlocked' ? 'var(--accent)' : 'var(--border-subtle)',
            }}
            transition={{ duration: 0.4, ease: easeSmooth }}
          >
            <i
              className="block h-1 rounded-sm"
              style={{ width: '70%', background: 'var(--text-tertiary)' }}
            />
            <i className="block h-1 rounded-sm" style={{ background: 'var(--border-strong)' }} />
            <i className="block h-1 rounded-sm" style={{ background: 'var(--border-strong)' }} />
            <i
              className="block h-1 rounded-sm"
              style={{ width: '55%', background: 'var(--border-strong)' }}
            />
            <motion.div
              className="absolute -right-[9px] -top-[9px] flex h-[22px] w-[22px] items-center justify-center rounded-full border"
              animate={{
                borderColor:
                  current.content === 'unlocked' ? 'var(--accent)' : 'var(--border-subtle)',
                backgroundColor:
                  current.content === 'unlocked' ? 'var(--accent-subtle)' : 'var(--bg-base)',
                color: current.content === 'unlocked' ? 'var(--accent)' : 'var(--text-tertiary)',
              }}
              transition={{ duration: 0.4, ease: easeSmooth }}
            >
              {current.content === 'unlocked' ? (
                <Check className="h-3 w-3" strokeWidth={2.4} aria-hidden />
              ) : (
                <Lock className="h-3 w-3" strokeWidth={1.5} aria-hidden />
              )}
            </motion.div>
          </motion.div>
        </Station>

        <AnimatePresence>
          {current.token && (
            <motion.div
              key={`token-${index}`}
              className="mono pointer-events-none absolute top-[15%] z-10 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-[5px] text-[11.5px] shadow-[0_6px_16px_rgba(0,0,0,0.35)]"
              style={{
                left: POS[current.token.at],
                background: tokenColors(current.token.variant).bg,
                borderColor: tokenColors(current.token.variant).border,
                color: tokenColors(current.token.variant).color,
              }}
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                left: POS[current.token.at],
              }}
              exit={{ opacity: 0 }}
              transition={{
                left: { duration: 0.6, ease: easeSmooth },
                opacity: { duration: 0.3, ease: easeSmooth },
              }}
              aria-hidden
            >
              {current.token.text}
              <span
                className="pointer-events-none absolute left-1/2 top-full h-3.5 w-px -translate-x-1/2"
                style={{ background: 'var(--border-strong)' }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {current.batch && (
            <motion.div
              key={`batch-${current.batch}`}
              className="mono absolute left-1/2 top-[88%] z-[4] flex -translate-x-1/2 items-center gap-2 rounded-lg px-[11px] py-[5px] text-[11px] text-accent"
              style={{ background: 'var(--accent-subtle)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: easeSmooth }}
            >
              <span className="h-[7px] w-[7px] rounded-full bg-accent" />
              {current.batch}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-2 flex min-h-[46px] items-center gap-3 border-t border-border-subtle pt-[18px]">
        <span
          className="h-2 w-2 flex-none rounded-full bg-accent"
          style={{ boxShadow: '0 0 0 4px var(--accent-subtle)' }}
          aria-hidden
        />
        <AnimatePresence mode="wait">
          <motion.span
            key={`caption-${index}`}
            className="text-[14.5px] leading-[1.4] text-ink-secondary"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: easeSmooth }}
          >
            <span className="[&_b]:font-medium [&_b]:text-ink-primary">{current.caption}</span>
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Station({
  label,
  left,
  children,
}: {
  label: string;
  left: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="absolute top-[54%] z-[2] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[11px]"
      style={{ left }}
    >
      {children}
      <span className="mono whitespace-nowrap text-[10.5px] text-ink-tertiary">{label}</span>
    </div>
  );
}
