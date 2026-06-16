'use client';

import type { ComponentType, ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Database,
  Package,
  RefreshCw,
  Target,
  type LucideProps,
} from 'lucide-react';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { ButtonLink } from '@/components/ui/ButtonLink';

const easeSmooth = [0.32, 0.72, 0, 1] as const;
const GITHUB_URL = 'https://github.com/StrimzLab/crawlpay';

const CRAWLER_CODE = `import { CrawlPayClient } from '@crawlpay/crawler-sdk';
import { dollarsToAtomic } from '@crawlpay/types';

const crawler = new CrawlPayClient({
  secretKey: process.env.CRAWLER_SECRET_KEY,
  network: 'stellar-testnet',
  maxPerRequest: dollarsToAtomic('0.001'),
  dailyBudget: dollarsToAtomic('5.00'),
  userAgent: 'MyResearchBot/1.0 (+https://mybot.example/contact)',
});

const { data, paid, receipt } = await crawler.fetch(
  'https://example-publisher.com/articles/foo',
);`;

interface Point {
  icon: ComponentType<LucideProps>;
  title: ReactNode;
  body: ReactNode;
}

const POINTS: Point[] = [
  {
    icon: Package,
    title: (
      <>
        Drop-in <span className="mono">fetch</span>.
      </>
    ),
    body: (
      <>
        <span className="mono">await crawler.fetch(url)</span> does the whole 402 dance.
      </>
    ),
  },
  { icon: Target, title: 'Per-request caps + daily budget.', body: 'Never overspend by accident.' },
  { icon: Database, title: 'Receipt cache.', body: 'Don’t pay twice for the same URL in 24h.' },
  {
    icon: RefreshCw,
    title: 'Smart retries.',
    body: 'Built-in policy for every facilitator error code.',
  },
  {
    icon: BarChart3,
    title: 'Full spend visibility.',
    body: 'The dashboard shows every cent, every URL.',
  },
];

export function ForCrawlers() {
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
          <span className="eyebrow">For crawler operators</span>
          <h2 className="h2">
            Stop getting blocked.
            <br />
            Pay fairly. Keep a receipt.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
          {/* code first in DOM (top on mobile), moves to right column on desktop via lg:order-2 */}
          <motion.div className="min-w-0 lg:order-2" {...reveal(0)}>
            <CodeBlock code={CRAWLER_CODE} filename="crawler.ts" language="typescript" />
          </motion.div>
          <motion.ul className="flex flex-col gap-[18px] lg:order-1" {...reveal(0.1)}>
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

        <motion.div className="mt-8" {...reveal(0)}>
          <ButtonLink href={GITHUB_URL} external>
            Install the SDK
            <ArrowRight className="h-4 w-4" aria-hidden />
          </ButtonLink>
        </motion.div>
      </div>
    </section>
  );
}
