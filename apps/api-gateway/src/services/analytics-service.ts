import type { StellarAddress } from '@crawlpay/types';
import type { ReceiptRepository, StoredReceipt } from '@crawlpay/persistence';

export type AnalyticsWindow = 'day' | 'week' | 'month';

export const WINDOW_DAYS: Record<AnalyticsWindow, number> = {
  day: 1,
  week: 7,
  month: 30,
};

export interface DailyDataPoint {
  /** YYYY-MM-DD (UTC). */
  date: string;
  /** Sum of amounts on this day, atomic USDC, stringified. */
  totalAtomic: string;
  /** Number of receipts on this day. */
  requestCount: number;
  /** Distinct counterparties on this day (crawlers for publisher view, publishers for crawler view). */
  uniqueCounterparties: number;
}

export interface PublisherAnalytics {
  publisherId: string;
  window: AnalyticsWindow;
  totalRevenueAtomic: string;
  totalRequestCount: number;
  uniqueCrawlers: number;
  daily: DailyDataPoint[];
}

export interface CrawlerAnalytics {
  crawlerWallet: StellarAddress;
  window: AnalyticsWindow;
  totalSpendAtomic: string;
  totalRequestCount: number;
  uniquePublishers: number;
  daily: DailyDataPoint[];
}

export interface AnalyticsService {
  forPublisher(publisherId: string, window: AnalyticsWindow): Promise<PublisherAnalytics>;
  forCrawler(walletAddress: StellarAddress, window: AnalyticsWindow): Promise<CrawlerAnalytics>;
}

/** Pulls all receipts in the window and aggregates in JS. Fine for demo volumes; at scale push the GROUP BY into SQL. */
export class RepositoryAnalyticsService implements AnalyticsService {
  readonly #receipts: ReceiptRepository;
  readonly #now: () => number;

  constructor(
    receipts: ReceiptRepository,
    now: () => number = () => Math.floor(Date.now() / 1000),
  ) {
    this.#receipts = receipts;
    this.#now = now;
  }

  async forPublisher(publisherId: string, window: AnalyticsWindow): Promise<PublisherAnalytics> {
    const days = WINDOW_DAYS[window];
    const nowUnix = this.#now();
    const receipts = await this.#receipts.list({
      publisherId,
      fromTimestamp: isoTimestamp(nowUnix - days * 86_400),
      limit: 100_000,
    });
    const totals = totalize(receipts, (r) => r.from);
    return {
      publisherId,
      window,
      totalRevenueAtomic: totals.totalAtomic,
      totalRequestCount: totals.requestCount,
      uniqueCrawlers: totals.uniqueCounterparties,
      daily: bucketize(receipts, days, nowUnix, (r) => r.from),
    };
  }

  async forCrawler(
    walletAddress: StellarAddress,
    window: AnalyticsWindow,
  ): Promise<CrawlerAnalytics> {
    const days = WINDOW_DAYS[window];
    const nowUnix = this.#now();
    const receipts = await this.#receipts.list({
      from: walletAddress,
      fromTimestamp: isoTimestamp(nowUnix - days * 86_400),
      limit: 100_000,
    });
    const totals = totalize(receipts, (r) => r.publisherId);
    return {
      crawlerWallet: walletAddress,
      window,
      totalSpendAtomic: totals.totalAtomic,
      totalRequestCount: totals.requestCount,
      uniquePublishers: totals.uniqueCounterparties,
      daily: bucketize(receipts, days, nowUnix, (r) => r.publisherId),
    };
  }
}

function totalize(
  receipts: StoredReceipt[],
  counterpartyOf: (r: StoredReceipt) => string,
): { totalAtomic: string; requestCount: number; uniqueCounterparties: number } {
  let total = 0n;
  const unique = new Set<string>();
  for (const r of receipts) {
    total += BigInt(r.amount);
    unique.add(counterpartyOf(r));
  }
  return {
    totalAtomic: total.toString(),
    requestCount: receipts.length,
    uniqueCounterparties: unique.size,
  };
}

function bucketize(
  receipts: StoredReceipt[],
  days: number,
  nowUnix: number,
  counterpartyOf: (r: StoredReceipt) => string,
): DailyDataPoint[] {
  const buckets = new Map<string, { total: bigint; count: number; unique: Set<string> }>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = isoDate(nowUnix - i * 86_400);
    buckets.set(date, { total: 0n, count: 0, unique: new Set() });
  }
  for (const r of receipts) {
    const b = buckets.get(r.timestamp.slice(0, 10));
    if (!b) continue;
    b.total += BigInt(r.amount);
    b.count += 1;
    b.unique.add(counterpartyOf(r));
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, b]) => ({
      date,
      totalAtomic: b.total.toString(),
      requestCount: b.count,
      uniqueCounterparties: b.unique.size,
    }));
}

function isoDate(unix: number): string {
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

function isoTimestamp(unix: number): string {
  return new Date(unix * 1000).toISOString();
}
