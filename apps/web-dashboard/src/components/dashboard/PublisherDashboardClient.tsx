'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowRight, LayoutGrid, Loader2, Receipt, Settings } from 'lucide-react';
import type { CrawlPayReceipt } from '@crawlpay/types';
import { DashLayout } from './DashLayout';
import { KpiCard } from './KpiCard';
import { DashChart, type ChartPoint, type WindowKey } from './DashChart';
import { LiveFeed, type FeedEntry } from './LiveFeed';
import { TopTable } from './TopTable';
import { Chip } from '@/components/ui/Chip';
import { getPublisher, type PublisherRecord } from '@/lib/api/publishers';
import { getPublisherReceipts } from '@/lib/api/receipts';
import {
  getPublisherAnalytics,
  type AnalyticsWindow,
  type PublisherAnalytics,
} from '@/lib/api/analytics';
import { getReputation, type ReputationSummary } from '@/lib/api/reputation';
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

type Props = { publisherId: string };

const LIVE_FEED_INTERVAL_MS = 5_000;

export function PublisherDashboardClient({ publisherId }: Props) {
  const [windowKey, setWindowKey] = useState<WindowKey>('week');

  const publisherQuery = useQuery({
    queryKey: ['publisher', publisherId],
    queryFn: () => getPublisher(publisherId),
    staleTime: 60_000,
  });

  const analyticsQuery = useQuery({
    queryKey: ['analytics', 'publisher', publisherId, windowKey],
    queryFn: () => getPublisherAnalytics(publisherId, windowKey as AnalyticsWindow),
    staleTime: 30_000,
  });

  const recentReceiptsQuery = useQuery({
    queryKey: ['receipts', 'publisher', publisherId, 'recent'],
    queryFn: () => getPublisherReceipts(publisherId, { limit: 10 }),
    refetchInterval: LIVE_FEED_INTERVAL_MS,
    staleTime: LIVE_FEED_INTERVAL_MS,
  });

  // wider window than the live feed; one bulk call powers the top table
  const broadReceiptsQuery = useQuery({
    queryKey: ['receipts', 'publisher', publisherId, 'broad'],
    queryFn: () => getPublisherReceipts(publisherId, { limit: 100 }),
    staleTime: 60_000,
  });

  // reputation lookup; gated on the publisher's G-address. mostly stable, so long stale time
  const walletAddress = publisherQuery.data?.walletAddress;
  const reputationQuery = useQuery({
    queryKey: ['reputation', walletAddress],
    queryFn: () => getReputation(walletAddress!),
    enabled: Boolean(walletAddress),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <DashLayout
      sidebarContext={publisherQuery.data?.domain ?? publisherId}
      sidebarItems={[
        { label: 'Overview', icon: LayoutGrid, href: `/publisher/${publisherId}`, active: true },
        { label: 'Receipts', icon: Receipt, href: `/publisher/${publisherId}/receipts` },
        { label: 'Settings', icon: Settings, disabled: true, soon: true },
      ]}
    >
      <PageHead
        publisher={publisherQuery.data}
        loading={publisherQuery.isLoading}
        error={publisherQuery.error}
        publisherId={publisherId}
        reputation={reputationQuery.data ?? null}
      />

      <KpiStrip analytics={analyticsQuery.data} loading={analyticsQuery.isLoading} />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          <DashChart
            title="Earnings over time"
            data={chartFromAnalytics(analyticsQuery.data, windowKey)}
            windowKey={windowKey}
            onWindowChange={setWindowKey}
            loading={analyticsQuery.isLoading}
            gradientKey={`pub-${publisherId}`}
          />
          <TopCrawlersTable receipts={broadReceiptsQuery.data?.receipts ?? []} />
        </div>
        <LiveFeed
          title="Live receipts"
          entries={feedFromReceipts(recentReceiptsQuery.data?.receipts ?? [], 'publisher')}
          loading={recentReceiptsQuery.isLoading}
        />
      </div>
    </DashLayout>
  );
}

function PageHead({
  publisher,
  loading,
  error,
  publisherId,
  reputation,
}: {
  publisher: PublisherRecord | null | undefined;
  loading: boolean;
  error: unknown;
  publisherId: string;
  reputation: ReputationSummary | null;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-start justify-between gap-6">
      <div>
        {loading ? (
          <div className="h-8 w-64 animate-pulse rounded bg-bg-elevated" aria-hidden />
        ) : error || !publisher ? (
          <h1 className="text-[26px] font-semibold tracking-tight md:text-[30px]">{publisherId}</h1>
        ) : (
          <h1 className="text-[26px] font-semibold tracking-tight md:text-[30px]">
            {publisher.domain}
          </h1>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <span className="mono text-[13px] text-ink-tertiary">{publisherId}</span>
          {publisher && (
            <Chip variant="mono" dot="steel">
              {networkLabel(publisher.network)}
            </Chip>
          )}
          {reputation && reputation.score !== null && (
            <Chip variant="accent">
              ★ {reputation.score}
              {reputation.provisional ? ' · provisional' : ` · ${reputation.settledCount} settled`}
            </Chip>
          )}
          {error ? (
            <Chip dot="warning">
              <AlertCircle className="h-3 w-3" aria-hidden />
              Publisher not found
            </Chip>
          ) : null}
        </div>
      </div>
      <Link
        href={`/publisher/${publisherId}/receipts`}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-strong bg-bg-surface px-4 text-sm text-ink-primary transition-colors hover:bg-bg-elevated"
      >
        View all receipts
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </header>
  );
}

function KpiStrip({
  analytics,
  loading,
}: {
  analytics: PublisherAnalytics | undefined;
  loading: boolean;
}) {
  const earnings = analytics ? atomicToUsd(analytics.totalRevenueAtomic) : '—';
  const crawls = analytics ? analytics.totalRequestCount.toLocaleString() : '—';
  const unique = analytics ? analytics.uniqueCrawlers.toLocaleString() : '—';
  const avg =
    analytics && analytics.totalRequestCount > 0
      ? atomicToUsd(BigInt(analytics.totalRevenueAtomic) / BigInt(analytics.totalRequestCount))
      : '—';

  return (
    <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label={`Earnings · ${analytics?.window ?? 'last 7d'}`}
        value={loading ? <KpiSkeleton /> : earnings}
        highlight
        delay={0}
      />
      <KpiCard label="Paid crawls" value={loading ? <KpiSkeleton /> : crawls} delay={0.05} />
      <KpiCard label="Unique crawlers" value={loading ? <KpiSkeleton /> : unique} delay={0.1} />
      <KpiCard label="Avg per crawl" value={loading ? <KpiSkeleton /> : avg} delay={0.15} />
    </div>
  );
}

function TopCrawlersTable({ receipts }: { receipts: CrawlPayReceipt[] }) {
  const top = useMemo(() => topCounterparties(receipts, 'publisher'), [receipts]);

  if (receipts.length === 0) {
    return (
      <section className="rounded-card border border-border-subtle bg-bg-surface p-6">
        <h3 className="mb-3 text-base font-semibold">Top crawlers</h3>
        <div className="py-6 text-center text-sm text-ink-tertiary">
          No crawlers yet. They&rsquo;ll appear once receipts start landing.
        </div>
      </section>
    );
  }

  return (
    <TopTable
      title="Top crawlers"
      badge="by total paid"
      columns={[
        { header: 'Crawler' },
        { header: 'Total paid', align: 'right' },
        { header: 'Crawls', align: 'right' },
        { header: 'Last seen', align: 'right' },
      ]}
      rows={top.map((r) => ({
        cells: [
          <span key="addr" className="mono text-ink-secondary">
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

// helpers

function chartFromAnalytics(
  analytics: PublisherAnalytics | undefined,
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

function networkLabel(network: PublisherRecord['network']): string {
  return network === 'stellar-mainnet' ? 'Stellar mainnet' : 'Stellar testnet';
}

function feedFromReceipts(receipts: CrawlPayReceipt[], mode: 'publisher' | 'crawler'): FeedEntry[] {
  return receipts.slice(0, 10).map((r) => ({
    id: r.nonce,
    url: r.resource,
    counterparty: truncateAddress(mode === 'publisher' ? r.from : r.to),
    amount: atomicToUsd(r.amount),
    timeAgo: timeAgoShort(isoToUnix(r.timestamp)),
  }));
}

interface CounterpartyAgg {
  key: string;
  totalAtomic: bigint;
  count: number;
  lastTimestamp: number;
}

function topCounterparties(
  receipts: CrawlPayReceipt[],
  mode: 'publisher' | 'crawler',
  limit = 5,
): CounterpartyAgg[] {
  const map = new Map<string, CounterpartyAgg>();
  for (const r of receipts) {
    const key = mode === 'publisher' ? r.from : r.to;
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
