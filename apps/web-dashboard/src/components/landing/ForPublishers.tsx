'use client';

import type { ComponentType, ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BadgeDollarSign,
  Lock,
  Puzzle,
  Receipt,
  Wrench,
  type LucideProps,
} from 'lucide-react';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { ButtonLink } from '@/components/ui/ButtonLink';

const easeSmooth = [0.32, 0.72, 0, 1] as const;
const GITHUB_URL = 'https://github.com/StrimzLab/octroi';

const PUBLISHER_CODE = `import express from 'express';
import { octroi } from '@octroi/proxy-middleware';
import { dollarsToAtomic } from '@octroi/types';

const app = express();

app.use(octroi({
  publisherId: 'pub_yourSite',
  payToAddress: 'GYOUR…WXYZ',
  network: 'stellar-testnet',
  defaultPrice: dollarsToAtomic('0.0001'),
  apiKey: process.env.OCTROI_API_KEY,
}));

app.get('/articles/:slug', (req, res) => {
  res.send('<article>…</article>');
});`;

interface Point {
  icon: ComponentType<LucideProps>;
  title: string;
  body: ReactNode;
}

const POINTS: Point[] = [
  {
    icon: Wrench,
    title: 'Three lines of middleware.',
    body: 'Express today; Fastify, Go and Python coming.',
  },
  {
    icon: BadgeDollarSign,
    title: 'Humans are free.',
    body: 'A built-in bot classifier paywalls only crawlers.',
  },
  {
    icon: Receipt,
    title: 'Signed receipts.',
    body: 'Every paid fetch is portable proof of access, verifiable without our database.',
  },
  {
    icon: Puzzle,
    title: 'Glob pricing rules.',
    body: (
      <>
        <span className="mono">/free/**</span> is free, <span className="mono">/research/**</span>{' '}
        is $0.001.
      </>
    ),
  },
  {
    icon: Lock,
    title: 'Your address, your keys.',
    body: 'We never touch the funds. Native USDC settles to your Stellar address, no bridge.',
  },
];

export function ForPublishers() {
  const reduced = useReducedMotion();
  const reveal = (delay = 0) => ({
    initial: { y: reduced ? 0 : 16, opacity: 0 },
    whileInView: { y: 0, opacity: 1 },
    viewport: { once: true, margin: '-80px' },
    transition: { duration: 0.5, delay, ease: easeSmooth },
  });

  return (
    <section className="section pt-6">
      <div className="wrap">
        <motion.div className="mb-10" {...reveal(0)}>
          <span className="eyebrow">For publishers</span>
          <h2 className="h2">
            Earn from the crawlers
            <br />
            already reading your site.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
          <motion.div className="min-w-0" {...reveal(0)}>
            <CodeBlock code={PUBLISHER_CODE} filename="server.ts" language="typescript" />
          </motion.div>
          <motion.ul className="flex flex-col gap-[18px]" {...reveal(0.1)}>
            {POINTS.map(({ icon: Icon, title, body }, i) => (
              <li key={i} className="flex items-start gap-3.5">
                <span
                  className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] text-accent"
                  style={{ background: 'var(--accent-subtle)' }}
                  aria-hidden
                >
                  <Icon className="h-[17px] w-[17px]" strokeWidth={1.5} />
                </span>
                <div>
                  <h4 className="text-[15px] font-semibold">{title}</h4>
                  <p className="text-sm leading-[1.5] text-ink-secondary">{body}</p>
                </div>
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div className="mt-8 flex flex-wrap items-center gap-3" {...reveal(0)}>
          <ButtonLink href="/onboard/publisher">
            Open a publisher
            <ArrowRight className="h-4 w-4" aria-hidden />
          </ButtonLink>
          <ButtonLink href={GITHUB_URL} external variant="secondary">
            View on GitHub
          </ButtonLink>
        </motion.div>
      </div>
    </section>
  );
}
