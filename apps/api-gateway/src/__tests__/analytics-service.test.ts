import { describe, expect, it } from 'vitest';
import { Keypair } from '@stellar/stellar-base';
import type { AssetId, CrawlPayReceipt, StellarAddress } from '@crawlpay/types';
import { MemoryReceiptRepository } from '@crawlpay/persistence';
import { RepositoryAnalyticsService } from '../services/analytics-service';

const PUBLISHER_A = Keypair.random().publicKey() as StellarAddress;
const CRAWLER_A = Keypair.random().publicKey() as StellarAddress;
const CRAWLER_B = Keypair.random().publicKey() as StellarAddress;
const USDC: AssetId = 'USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

// anchor to mid-day UTC so receipts a few hours back don't cross a date boundary
const NOW = Math.floor(Date.UTC(2026, 3, 27, 12, 0, 0) / 1000); // 2026-04-27 12:00 UTC
const DAY = 86_400;

function iso(unix: number): string {
  return new Date(unix * 1000).toISOString();
}

interface Entry {
  receipt: CrawlPayReceipt;
  publisherId: string;
}

function makeEntry(opts: {
  publisherId?: string;
  from?: StellarAddress;
  amount?: string;
  atUnix: number;
  nonce: string;
}): Entry {
  const receipt: CrawlPayReceipt = {
    version: '1',
    resource: 'https://example.com/x',
    amount: opts.amount ?? '100',
    asset: USDC,
    network: 'stellar-testnet',
    from: opts.from ?? CRAWLER_A,
    to: PUBLISHER_A,
    nonce: opts.nonce,
    timestamp: iso(opts.atUnix),
    settlement: 'x402',
    onchainTxHash: 'tx',
    mppSessionRef: null,
    facilitatorPubkey: Keypair.random().publicKey() as StellarAddress,
    signature: 'c2ln' as CrawlPayReceipt['signature'],
  };
  return { receipt, publisherId: opts.publisherId ?? 'pub_a' };
}

async function seedRepo(entries: Entry[]) {
  const repo = new MemoryReceiptRepository();
  for (const e of entries) await repo.insert(e.receipt, e.publisherId);
  return repo;
}

describe('RepositoryAnalyticsService.forPublisher', () => {
  it('sums revenue, counts requests, dedups crawlers within the window', async () => {
    const repo = await seedRepo([
      makeEntry({ nonce: 'n1', amount: '100', atUnix: NOW - 1 * DAY }),
      makeEntry({ nonce: 'n2', amount: '300', atUnix: NOW - 2 * DAY, from: CRAWLER_B }),
      makeEntry({ nonce: 'n3', amount: '100', atUnix: NOW - 3 * DAY }),
    ]);
    const svc = new RepositoryAnalyticsService(repo, () => NOW);

    const a = await svc.forPublisher('pub_a', 'week');
    expect(a.totalRevenueAtomic).toBe('500');
    expect(a.totalRequestCount).toBe(3);
    expect(a.uniqueCrawlers).toBe(2);
    expect(a.window).toBe('week');
    expect(a.publisherId).toBe('pub_a');
  });

  it('emits a daily series with zero-padded buckets', async () => {
    const repo = await seedRepo([
      makeEntry({ nonce: 'n1', amount: '100', atUnix: NOW - 1 * DAY }),
      makeEntry({ nonce: 'n2', amount: '200', atUnix: NOW - 1 * DAY, from: CRAWLER_B }),
      makeEntry({ nonce: 'n3', amount: '500', atUnix: NOW - 4 * DAY }),
    ]);
    const svc = new RepositoryAnalyticsService(repo, () => NOW);

    const a = await svc.forPublisher('pub_a', 'week');
    expect(a.daily).toHaveLength(7);

    const yest = iso(NOW - 1 * DAY).slice(0, 10);
    const yestBucket = a.daily.find((d) => d.date === yest);
    expect(yestBucket?.totalAtomic).toBe('300');
    expect(yestBucket?.requestCount).toBe(2);
    expect(yestBucket?.uniqueCounterparties).toBe(2);

    const empty = a.daily.find((d) => d.totalAtomic === '0');
    expect(empty).toBeDefined();
  });

  it('excludes receipts outside the window', async () => {
    const repo = await seedRepo([
      makeEntry({ nonce: 'n1', amount: '100', atUnix: NOW - 1 * DAY }),
      makeEntry({ nonce: 'n2', amount: '999', atUnix: NOW - 10 * DAY }),
    ]);
    const svc = new RepositoryAnalyticsService(repo, () => NOW);

    const a = await svc.forPublisher('pub_a', 'week');
    expect(a.totalRevenueAtomic).toBe('100');
    expect(a.totalRequestCount).toBe(1);
  });
});

describe('RepositoryAnalyticsService.forCrawler', () => {
  it('sums spend across publishers within the window', async () => {
    const repo = await seedRepo([
      makeEntry({ nonce: 'n1', publisherId: 'pub_a', amount: '100', atUnix: NOW - 1 * DAY }),
      makeEntry({ nonce: 'n2', publisherId: 'pub_b', amount: '400', atUnix: NOW - 2 * DAY }),
      makeEntry({ nonce: 'n3', publisherId: 'pub_a', amount: '100', atUnix: NOW - 3 * DAY }),
    ]);
    const svc = new RepositoryAnalyticsService(repo, () => NOW);

    const a = await svc.forCrawler(CRAWLER_A, 'week');
    expect(a.totalSpendAtomic).toBe('600');
    expect(a.totalRequestCount).toBe(3);
    expect(a.uniquePublishers).toBe(2);
  });

  it('day window produces a single bucket', async () => {
    const repo = await seedRepo([
      makeEntry({ nonce: 'n1', amount: '100', atUnix: NOW - 3 * 3600 }),
    ]);
    const svc = new RepositoryAnalyticsService(repo, () => NOW);

    const a = await svc.forCrawler(CRAWLER_A, 'day');
    expect(a.daily).toHaveLength(1);
    expect(a.daily[0]!.totalAtomic).toBe('100');
  });
});
