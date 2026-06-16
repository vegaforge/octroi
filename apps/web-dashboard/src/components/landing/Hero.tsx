'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { HeroWalkthrough } from './HeroWalkthrough';

const GITHUB_URL = 'https://github.com/StrimzLab/crawlpay';
const easeSmooth = [0.32, 0.72, 0, 1] as const;

/** Landing hero. Walkthrough sits between headline and CTAs so the eye lands on it first. */
export function Hero() {
  const reduced = useReducedMotion();
  const fade = (delay: number) => ({
    initial: { y: reduced ? 0 : 12, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    transition: { duration: 0.5, delay, ease: easeSmooth },
  });

  return (
    <section className="relative overflow-hidden">
      <div className="hero-glow" aria-hidden />
      <div className="hero-grain" aria-hidden />

      <div className="wrap relative z-10">
        <div className="flex min-h-[calc(100vh-var(--nav-h))] flex-col items-center justify-center gap-8 py-12 text-center md:gap-10 md:py-16">
          <motion.h1 className="h1 max-w-[20ch]" {...fade(0.07)}>
            <span className="text-accent">Pay</span>-per-crawl infrastructure for the open web.
          </motion.h1>

          {/* walkthrough sits between headline and supporting copy */}
          <motion.div className="w-full" {...fade(0.12)}>
            <div className="w-full flex justify-center">
              <HeroWalkthrough />
            </div>
          </motion.div>

          <motion.p className="lead max-w-[56ch]" {...fade(0.18)}>
            Publishers charge AI crawlers per URL. Crawlers pay{' '}
            <span className="mono text-accent">$0.0001</span> per fetch, gas-free, with a
            cryptographic receipt. No new protocol. No lock-in.
          </motion.p>

          <motion.div className="flex flex-wrap items-center justify-center gap-3" {...fade(0.25)}>
            <ButtonLink href="/onboard/publisher" size="lg">
              Get started
              <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
            <ButtonLink href={GITHUB_URL} external variant="secondary" size="lg">
              View on GitHub
            </ButtonLink>
          </motion.div>

          <motion.p className="mono text-[13px] text-ink-tertiary" {...fade(0.3)}>
            Apache 2.0 · self-host anytime
          </motion.p>
        </div>
      </div>
    </section>
  );
}
