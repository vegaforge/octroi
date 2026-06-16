'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const easeSmooth = [0.32, 0.72, 0, 1] as const;

export type WindowKey = 'day' | 'week' | 'month';

export interface ChartPoint {
  date: string;
  value: number;
  /** Sub-line shown in tooltip ("12 crawls"). */
  sub: string;
}

type DashChartProps = {
  title: string;
  data: ChartPoint[];
  windowKey: WindowKey;
  onWindowChange: (next: WindowKey) => void;
  /** Show a centered spinner instead of the chart while data hasn't loaded. */
  loading?: boolean;
  /** Stable id for the gradient def, avoids collisions when two charts share a page. */
  gradientKey?: string;
};

const WINDOWS: { key: WindowKey; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

/**
 * Earnings/spend area chart. Parent owns window state so the analytics call
 * re-fires on change. On raw Recharts so colors come straight from CSS vars.
 */
export function DashChart({
  title,
  data,
  windowKey,
  onWindowChange,
  loading,
  gradientKey = 'dash',
}: DashChartProps) {
  const gradientId = `dash-chart-grad-${gradientKey}`;

  return (
    <section className="rounded-card border border-border-subtle bg-bg-surface p-6">
      <header className="mb-5 flex items-center justify-between gap-4">
        <h3 className="text-base font-semibold">{title}</h3>
        <WindowToggle value={windowKey} onChange={onWindowChange} />
      </header>
      <div className="h-[280px] w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center text-ink-tertiary">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-ink-tertiary">
            No data for this window yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="var(--text-tertiary)"
                tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis
                stroke="var(--text-tertiary)"
                tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(v) => `$${(v as number).toFixed(4)}`}
              />
              <Tooltip
                cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '3 3' }}
                content={<CustomTooltip />}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--accent)"
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: 'var(--accent)',
                  stroke: 'var(--bg-base)',
                  strokeWidth: 2,
                }}
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as ChartPoint | undefined;
  if (!point) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-lg"
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-strong)' }}
    >
      <div className="text-xs text-ink-tertiary">{label}</div>
      <div className="mono mt-1 text-sm text-ink-primary">${point.value.toFixed(4)} USDC</div>
      <div className="mt-0.5 text-xs text-ink-secondary">{point.sub}</div>
    </div>
  );
}

function WindowToggle({
  value,
  onChange,
}: {
  value: WindowKey;
  onChange: (next: WindowKey) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Time window"
      className="inline-flex rounded-lg border border-border-subtle bg-bg-elevated p-[3px]"
    >
      {WINDOWS.map((w) => {
        const active = value === w.key;
        return (
          <button
            key={w.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(w.key)}
            className={cn(
              'relative rounded-md px-3 py-1 text-[13px] transition-colors',
              active ? 'text-ink-primary' : 'text-ink-secondary hover:text-ink-primary',
            )}
          >
            {active && (
              <motion.span
                layoutId="windowPill"
                className="absolute inset-0 rounded-md bg-bg-surface"
                transition={{ duration: 0.2, ease: easeSmooth }}
              />
            )}
            <span className="relative z-10">{w.label}</span>
          </button>
        );
      })}
    </div>
  );
}
