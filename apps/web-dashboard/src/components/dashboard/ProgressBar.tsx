'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

const easeSmooth = [0.32, 0.72, 0, 1] as const;

type ProgressBarProps = {
  /** 0 ≤ ratio ≤ 1. Clamped on render. */
  ratio: number;
  /** Color thresholds: accent < warn (60%) < error (85%). */
  thresholds?: { warn: number; error: number };
  className?: string;
};

/** Crawler daily-budget bar. Color shifts as it fills. */
export function ProgressBar({
  ratio,
  thresholds = { warn: 0.6, error: 0.85 },
  className,
}: ProgressBarProps) {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, ratio));
  const tone =
    clamped < thresholds.warn
      ? 'bg-accent'
      : clamped < thresholds.error
        ? 'bg-[color:var(--warning)]'
        : 'bg-clay';

  return (
    <div className={cn('mt-3 h-2.5 overflow-hidden rounded-full bg-bg-elevated', className)}>
      <motion.div
        className={cn('h-full rounded-full', tone)}
        initial={{ width: reduced ? `${clamped * 100}%` : 0 }}
        animate={{ width: `${clamped * 100}%` }}
        transition={{ duration: 0.6, ease: easeSmooth }}
      />
    </div>
  );
}
