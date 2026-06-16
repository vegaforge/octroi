'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Chip } from '@/components/ui/Chip';

const easeSmooth = [0.32, 0.72, 0, 1] as const;

interface Tier {
  name: string;
  amount: string;
  amountTone: 'free' | 'fee';
  per: string;
  bullets: string[];
  recommended?: boolean;
}

const TIERS: Tier[] = [
  {
    name: 'Self-host',
    amount: 'Free',
    amountTone: 'free',
    per: 'forever · BUSL-1.1',
    bullets: [
      'Full stack, source-available',
      'You run Postgres + Redis + the facilitator',
      'No protocol fee, ever',
    ],
  },
  {
    name: 'Hosted (v0 testnet)',
    amount: 'Free',
    amountTone: 'free',
    per: 'during testnet',
    bullets: [
      'Our facilitator, our database',
      'Your wallet, funds never touch us',
      'Live dashboard + receipt feed',
    ],
    recommended: true,
  },
  {
    name: 'Hosted (mainnet, v1)',
    amount: '2.5%',
    amountTone: 'fee',
    per: 'of settled USDC',
    bullets: ['Everything in testnet', 'Uptime SLA + webhooks', 'Priority support'],
  },
];

export function Pricing() {
  const reduced = useReducedMotion();
  const reveal = (delay = 0) => ({
    initial: { y: reduced ? 0 : 16, opacity: 0 },
    whileInView: { y: 0, opacity: 1 },
    viewport: { once: true, margin: '-80px' },
    transition: { duration: 0.5, delay, ease: easeSmooth },
  });

  return (
    <section className="section">
      <div className="wrap">
        <motion.div {...reveal(0)}>
          <span className="eyebrow">What you pay</span>
          <h2 className="h2">It&rsquo;s open source.</h2>
          <p className="lead mt-3 max-w-[48ch]">
            The only price is the protocol fee on the hosted service.
          </p>
        </motion.div>

        <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.name}
              {...reveal(i * 0.1)}
              className={cn(
                'relative flex flex-col rounded-card border bg-bg-surface p-6 transition-colors',
                tier.recommended
                  ? 'border-accent shadow-[inset_3px_0_0_var(--accent)]'
                  : 'border-border-subtle hover:border-border-strong',
              )}
              whileHover={tier.recommended ? undefined : { y: -2 }}
            >
              {/* chip in normal flow at top of card, so no absolute positioning needed */}
              {tier.recommended && (
                <Chip variant="accent" className="mb-4 self-start">
                  Recommended
                </Chip>
              )}
              <div className="mb-3 text-[13px] font-medium text-ink-secondary">{tier.name}</div>
              <div
                className={cn(
                  'mono mb-1 text-[30px] font-medium leading-none tracking-tight',
                  tier.amountTone === 'free' ? 'text-[color:var(--success)]' : 'text-accent',
                )}
              >
                {tier.amount}
              </div>
              <div className="mb-5 text-[13px] text-ink-tertiary">{tier.per}</div>
              <ul className="mt-auto flex flex-col gap-[11px]">
                {tier.bullets.map((b) => (
                  <li
                    key={b}
                    className="flex gap-2.5 text-[13.5px] leading-[1.45] text-ink-secondary"
                  >
                    <span className="mt-2 inline-block h-[5px] w-[5px] flex-none rounded-full bg-ink-tertiary" />
                    {b}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
