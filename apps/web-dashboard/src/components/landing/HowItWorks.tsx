'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

const easeSmooth = [0.32, 0.72, 0, 1] as const;

interface Node {
  step: string;
  title: string;
  body: React.ReactNode;
  detail: React.ReactNode;
}

// HTTPie-style coloring in the wire-exchange panels: GET=steel, POST=plum, 2xx=sage,
// 4xx=accent, headers=parchment, string values=sage, hex/number values=accent, comments=tertiary.
const NODES: Node[] = [
  {
    step: '01',
    title: 'Crawler requests',
    body: <>A bot fetches a paywalled URL on the publisher&rsquo;s site.</>,
    detail: (
      <>
        <span className="italic text-ink-tertiary"># crawler → publisher</span>
        {'\n'}
        <span className="font-semibold text-steel">GET</span>{' '}
        <span className="text-ink-primary">/articles/foo</span>{' '}
        <span className="text-ink-tertiary">HTTP/1.1</span>
        {'\n'}
        <span className="text-[#cfcabb]">User-Agent:</span>{' '}
        <span className="text-ink-secondary">MyResearchBot/1.0</span>
      </>
    ),
  },
  {
    step: '02',
    title: '402 + offer',
    body: (
      <>
        Middleware replies <span className="mono">402</span> with a signed price offer.
      </>
    ),
    detail: (
      <>
        <span className="italic text-ink-tertiary"># publisher → crawler · paywalled</span>
        {'\n'}
        <span className="text-ink-tertiary">HTTP/1.1</span>{' '}
        <span className="font-semibold text-accent">402</span>{' '}
        <span className="text-ink-primary">Payment Required</span>
        {'\n'}
        <span className="text-[#cfcabb]">X-PAYMENT:</span>{' '}
        <span className="text-sage">price=&quot;1000&quot;</span>;{' '}
        <span className="text-sage">asset=USDC</span>;{' '}
        <span className="text-sage">network=stellar-testnet</span>
      </>
    ),
  },
  {
    step: '03',
    title: 'Crawler signs',
    body: (
      <>
        A <span className="mono">Soroban</span> authorization entry, signed off-chain, no gas.
      </>
    ),
    detail: (
      <>
        <span className="italic text-ink-tertiary">
          # crawler signs a Soroban auth entry, off-chain, no gas
        </span>
        {'\n'}
        <span className="text-[#cfcabb]">X-PAYMENT:</span>{' '}
        <span className="text-accent">GD9F…E217</span>
        {'\n  '}
        <span className="text-ink-secondary">from</span>
        <span className="text-ink-tertiary">=</span>
        <span className="text-accent">GA4A…B720</span>
        {'  '}
        <span className="text-ink-secondary">value</span>
        <span className="text-ink-tertiary">=</span>
        <span className="text-accent">1000</span>
        {'  '}
        <span className="text-ink-secondary">validBefore</span>
        <span className="text-ink-tertiary">=</span>
        <span className="text-accent">1780…</span>
      </>
    ),
  },
  {
    step: '04',
    title: 'Soroban settles',
    body: <>An MPP session batches debits into one USDC SAC transfer.</>,
    detail: (
      <>
        <span className="italic text-ink-tertiary"># facilitator → MPP session → Soroban</span>
        {'\n'}
        <span className="font-semibold text-[#c98bdb]">POST</span>{' '}
        <span className="text-ink-primary">/settle</span>{' '}
        <span className="text-ink-tertiary">→ session</span>{' '}
        <span className="text-accent">#1841</span>
        {'\n'}
        <span className="text-ink-secondary">stellar.tx</span>{' '}
        <span className="text-ink-tertiary">=</span> <span className="text-accent">1f7a9c…</span>
        {'   '}
        <span className="italic text-ink-tertiary">(1 tx · 3,204 debits)</span>
      </>
    ),
  },
  {
    step: '05',
    title: '200 + receipt',
    body: <>Content unlocks; a portable signed receipt is issued.</>,
    detail: (
      <>
        <span className="italic text-ink-tertiary"># publisher → crawler · unlocked</span>
        {'\n'}
        <span className="text-ink-tertiary">HTTP/1.1</span>{' '}
        <span className="font-semibold text-sage">200</span>{' '}
        <span className="text-ink-primary">OK</span>
        {'\n'}
        <span className="text-[#cfcabb]">X-PAYMENT-RESPONSE:</span>{' '}
        <span className="text-ink-tertiary">&#123;</span>{' '}
        <span className="text-ink-secondary">amount</span>
        <span className="text-ink-tertiary">:</span>
        <span className="text-accent">1000</span>
        <span className="text-ink-tertiary">,</span> <span className="text-ink-secondary">sig</span>
        <span className="text-ink-tertiary">:</span>
        <span className="text-accent">a3f1c2…</span>{' '}
        <span className="text-ink-tertiary">&#125;</span>
      </>
    ),
  },
];

const NOTES = [
  {
    n: '01',
    h: 'Sub-cent settlement',
    p: <>Stellar&rsquo;s base fee is ~$0.00001, well under a single crawl.</>,
  },
  {
    n: '02',
    h: 'No gas token for the crawler',
    p: <>The crawler holds only USDC; the facilitator sponsors the fees.</>,
  },
  {
    n: '03',
    h: 'Verify with no DB',
    p: (
      <>The facilitator&rsquo;s key is named on the receipt; the Ed25519 signature is on it too.</>
    ),
  },
];

export function HowItWorks() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  // auto-advance every 2.6s once visible, unless hovering a node
  useEffect(() => {
    if (!inView || reduced || paused) return;
    const id = window.setInterval(() => {
      setActive((a) => (a + 1) % NODES.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, [inView, reduced, paused]);

  return (
    <section ref={ref} className="section border-y border-border-subtle bg-bg-surface">
      <div className="wrap">
        <motion.div
          initial={{ y: reduced ? 0 : 16, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, ease: easeSmooth }}
        >
          <span className="eyebrow">How it works</span>
          <h2 className="h2">x402 negotiates. MPP batches. Soroban settles.</h2>
        </motion.div>

        {/* playhead rail, desktop only */}
        <div className="relative mt-11 hidden h-3.5 lg:block" aria-hidden>
          <span className="absolute left-[10%] right-[10%] top-1/2 h-0.5 -translate-y-1/2 bg-border-subtle" />
          <motion.span
            className="absolute left-[10%] top-1/2 h-0.5 -translate-y-1/2 bg-accent"
            animate={{ width: `${active * 20}%` }}
            transition={{ duration: 0.6, ease: easeSmooth }}
          />
          <motion.span
            className="absolute top-1/2 z-[2] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_0_5px_var(--accent-subtle)]"
            animate={{ left: `${10 + active * 20}%` }}
            transition={{ duration: 0.6, ease: easeSmooth }}
          />
        </div>

        <div className="mt-3.5 grid grid-cols-1 items-stretch gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
          {NODES.map((node, i) => {
            const isActive = i === active;
            const isDone = i < active;
            return (
              <button
                key={node.step}
                type="button"
                onMouseEnter={() => {
                  setPaused(true);
                  setActive(i);
                }}
                onMouseLeave={() => setPaused(false)}
                onClick={() => setActive(i)}
                className={cn(
                  'rounded-card border border-border-subtle bg-bg-surface p-4 text-left transition-all duration-200',
                  'hover:border-border-strong',
                  isActive &&
                    '!border-accent bg-bg-elevated -translate-y-0.5 shadow-[0_14px_34px_rgba(0,0,0,0.28)]',
                )}
              >
                <span
                  className={cn(
                    'mono text-[11px] transition-colors',
                    isDone || isActive ? 'text-accent' : 'text-ink-tertiary',
                  )}
                >
                  {node.step}
                </span>
                <h4 className="mt-2 text-[14.5px] font-semibold">{node.title}</h4>
                <p className="mt-1 text-[12.5px] leading-[1.45] text-ink-secondary">{node.body}</p>
              </button>
            );
          })}
        </div>

        {/* min-h stops layout jump between 2- and 3-line payloads */}
        <div className="mono mt-6 flex min-h-[140px] flex-col justify-center whitespace-pre-wrap rounded-card border border-border-subtle bg-[#0B1015] px-6 py-5 text-[13px] leading-[1.75] text-ink-secondary">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: easeSmooth }}
            >
              {NODES[active]!.detail}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-7 md:grid-cols-3">
          {NOTES.map((note, i) => (
            <motion.div
              key={note.n}
              className="flex flex-col gap-1.5"
              initial={{ y: reduced ? 0 : 12, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: i * 0.08, ease: easeSmooth }}
            >
              <span className="mono text-[12px] text-accent">{note.n}</span>
              <h5 className="text-sm font-semibold">{note.h}</h5>
              <p className="text-[13px] leading-[1.5] text-ink-secondary">{note.p}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
