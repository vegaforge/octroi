'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, LayoutGrid, Loader2, Receipt, Settings } from 'lucide-react';
import type { CrawlPayReceipt } from '@crawlpay/types';
import { DashLayout } from './DashLayout';
import { KpiCard } from './KpiCard';
import { DashChart, type ChartPoint, type WindowKey } from './DashChart';
import { LiveFeed, type FeedEntry } from './LiveFeed';
import { TopTable } from './TopTable';
import { Chip } from '@/components/ui/Chip';
import { getCrawlerReceipts } from '@/lib/api/receipts';
import {
  getCrawlerAnalytics,
  type AnalyticsWindow,
  type CrawlerAnalytics,
} from '@/lib/api/analytics';
import { getReputation } from '@/lib/api/reputation';
import {
  atomicToDollarsNumber,
  atomicToUsd,
  isoDateToDow,
  isoDateToShort,
  isoToUnix,
  timeAgo,
  timeAgoShort,
  truncateAddress,
} from '@/lib/format';

type Props = { wallet: string };

const LIVE_FEED_INTERVAL_MS = 5_000;

export function CrawlerDashboardClient({ wallet }: Props) {
  const [windowKey, setWindowKey] = useState<WindowKey>('week');

  const analyticsQuery = useQuery({
    queryKey: ['analytics', 'crawler', wallet, windowKey],
    queryFn: () => getCrawlerAnalytics(wallet, windowKey as AnalyticsWindow),
    staleTime: 30_000,
  });

  const recentReceiptsQuery = useQuery({
    queryKey: ['receipts', 'crawler', wallet, 'recent'],
    queryFn: () => getCrawlerReceipts(wallet, { limit: 10 }),
    refetchInterval: LIVE_FEED_INTERVAL_MS,
    staleTime: LIVE_FEED_INTERVAL_MS,
  });

  const broadReceiptsQuery = useQuery({
    queryKey: ['receipts', 'crawler', wallet, 'broad'],
    queryFn: () => getCrawlerReceipts(wallet, { limit: 100 }),
    staleTime: 60_000,
  });

  // Reputation lookup against crawlpay_registry. Crawler accounts (AI agents)
  // are the most likely to be registered there.
  const reputationQuery = useQuery({
    queryKey: ['reputation', wallet],
    queryFn: () => getReputation(wallet),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <DashLayout
      sidebarContext="Crawler"
      sidebarItems={[
        { label: 'Overview', icon: LayoutGrid, href: `/crawler/${wallet}`, active: true },
        { label: 'Receipts', icon: Receipt, href: `/crawler/${wallet}/receipts` },
        { label: 'Budgets', icon: Settings, disabled: true, soon: true },
      ]}
    >
      <header className="mb-7 flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="mono text-[22px] font-semibold tracking-tight md:text-[26px]">
            {truncateAddress(wallet)}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <Chip variant="mono" dot="steel">
              Stellar testnet
            </Chip>
            {reputationQuery.data && reputationQuery.data.score !== null && (
              <Chip variant="accent">
                ★ {reputationQuery.data.score}
                {reputationQuery.data.provisional
                  ? ' · provisional'
                  : ` · ${reputationQuery.data.settledCount} settled`}
              </Chip>
            )}
            <span className="mono text-[12px] text-ink-tertiary">{wallet}</span>
          </div>
        </div>
        <Link
          href={`/crawler/${wallet}/receipts`}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-strong bg-bg-surface px-4 text-sm text-ink-primary transition-colors hover:bg-bg-elevated"
        >
          View all receipts
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </header>

      <KpiStrip analytics={analyticsQuery.data} loading={analyticsQuery.isLoading} />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          <DashChart
            title="Spend over time"
            data={chartFromAnalytics(analyticsQuery.data, windowKey)}
            windowKey={windowKey}
            onWindowChange={setWindowKey}
            loading={analyticsQuery.isLoading}
            gradientKey={`crw-${wallet}`}
          />
          <TopPublishersTable receipts={broadReceiptsQuery.data?.receipts ?? []} />
        </div>
        <LiveFeed
          title="Live fetches"
          entries={feedFromReceipts(recentReceiptsQuery.data?.receipts ?? [])}
          loading={recentReceiptsQuery.isLoading}
        />
      </div>
    </DashLayout>
  );
}

function KpiStrip({
  analytics,
  loading,
}: {
  analytics: CrawlerAnalytics | undefined;
  loading: boolean;
}) {
  const spend = analytics ? atomicToUsd(analytics.totalSpendAtomic) : '—';
  const crawls = analytics ? analytics.totalRequestCount.toLocaleString() : '—';
  const unique = analytics ? analytics.uniquePublishers.toLocaleString() : '—';
  const avg =
    analytics && analytics.totalRequestCount > 0
      ? atomicToUsd(BigInt(analytics.totalSpendAtomic) / BigInt(analytics.totalRequestCount))
      : '—';

  return (
    <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label={`Total spend · ${analytics?.window ?? 'last 7d'}`}
        value={loading ? <KpiSkeleton /> : spend}
        highlight
        delay={0}
      />
      <KpiCard label="Paid crawls" value={loading ? <KpiSkeleton /> : crawls} delay={0.05} />
      <KpiCard label="Unique publishers" value={loading ? <KpiSkeleton /> : unique} delay={0.1} />
      <KpiCard label="Avg per crawl" value={loading ? <KpiSkeleton /> : avg} delay={0.15} />
    </div>
  );
}

function TopPublishersTable({ receipts }: { receipts: CrawlPayReceipt[] }) {
  const top = useMemo(() => topPublishers(receipts), [receipts]);

  if (receipts.length === 0) {
    return (
      <section className="rounded-card border border-border-subtle bg-bg-surface p-6">
        <h3 className="mb-3 text-base font-semibold">Top publishers</h3>
        <div className="py-6 text-center text-sm text-ink-tertiary">
          No publishers paid yet. They&rsquo;ll appear once crawls start.
        </div>
      </section>
    );
  }

  return (
    <TopTable
      title="Top publishers"
      badge="by total paid"
      columns={[
        { header: 'Publisher' },
        { header: 'Total paid', align: 'right' },
        { header: 'Crawls', align: 'right' },
        { header: 'Last seen', align: 'right' },
      ]}
      rows={top.map((r) => ({
        cells: [
          <span key="pub" className="mono text-ink-secondary">
            {truncateAddress(r.key)}
          </span>,
          <span key="paid" className="mono text-accent">
            {atomicToUsd(r.totalAtomic.toString())}
          </span>,
          <span key="cnt" className="mono">
            {r.count.toLocaleString()}
          </span>,
          <span key="ts" className="mono text-ink-tertiary">
            {timeAgo(r.lastTimestamp)}
          </span>,
        ],
      }))}
    />
  );
}

function KpiSkeleton() {
  return (
    <span className="inline-flex h-7 w-20 items-center rounded bg-bg-elevated">
      <Loader2 className="ml-2 h-3.5 w-3.5 animate-spin text-ink-tertiary" aria-hidden />
    </span>
  );
}

function chartFromAnalytics(
  analytics: CrawlerAnalytics | undefined,
  windowKey: WindowKey,
): ChartPoint[] {
  if (!analytics) return [];
  return analytics.daily.map((d) => ({
    date:
      windowKey === 'week'
        ? isoDateToDow(d.date)
        : windowKey === 'month'
          ? isoDateToShort(d.date)
          : d.date,
    value: atomicToDollarsNumber(d.totalAtomic),
    sub: `${d.requestCount} crawl${d.requestCount === 1 ? '' : 's'}`,
  }));
}

function feedFromReceipts(receipts: CrawlPayReceipt[]): FeedEntry[] {
  return receipts.slice(0, 10).map((r) => ({
    id: r.nonce,
    url: r.resource,
    counterparty: truncateAddress(r.to),
    amount: atomicToUsd(r.amount),
    timeAgo: timeAgoShort(isoToUnix(r.timestamp)),
  }));
}

interface PublisherAgg {
  key: string;
  totalAtomic: bigint;
  count: number;
  lastTimestamp: number;
}

function topPublishers(receipts: CrawlPayReceipt[], limit = 5): PublisherAgg[] {
  const map = new Map<string, PublisherAgg>();
  for (const r of receipts) {
    const key = r.to;
    const prev = map.get(key) ?? { key, totalAtomic: 0n, count: 0, lastTimestamp: 0 };
    prev.totalAtomic += BigInt(r.amount);
    prev.count += 1;
    prev.lastTimestamp = Math.max(prev.lastTimestamp, isoToUnix(r.timestamp));
    map.set(key, prev);
  }
  return Array.from(map.values())
    .sort((a, b) => (b.totalAtomic > a.totalAtomic ? 1 : b.totalAtomic < a.totalAtomic ? -1 : 0))
    .slice(0, limit);
}
