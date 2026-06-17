import type {
  AssetId,
  AtomicUsdc,
  CrawlPayErrorCode,
  CrawlPayReceipt,
  Network,
  StellarAddress,
} from '@crawlpay/types';
import type { BudgetTracker } from './budget';
import type { FetchCache } from './fetch-cache';
import type { PaymentSigner } from './payment-signer';
import type { ReceiptStore } from './receipt-store';
import type { RetryPolicy } from './retry';

export interface CrawlPayClientConfig {
  /** Crawler's Stellar secret seed. Its account must hold USDC to spend. */
  secret: string;
  /** Network the crawler operates on. */
  network: Network;
  /** Soroban RPC endpoint. Required unless a custom `paymentSigner` is supplied. */
  sorobanRpcUrl?: string;
  /** USDC asset (`CODE:ISSUER`). Required for `getBalance` with the default signer. */
  usdcAsset?: AssetId;
  /** Hard per-request cap. The SDK refuses to pay more than this for any URL. */
  maxPerRequest: AtomicUsdc;
  /** Optional daily spend cap across all publishers (UTC day). */
  dailyBudget?: AtomicUsdc;
  /** User-Agent sent on all outbound requests. */
  userAgent?: string;
  /** How long a cached fetch result is reused before re-paying. Default 86400 (24h). */
  cacheSeconds?: number;
  /** Warn at this fraction of daily budget consumed. Default 0.8 (80%). */
  budgetWarningRatio?: number;

  // ── Pluggable dependencies ─────────────────────────────────────
  /** Custom payment signer (defaults to the Stellar signer). */
  paymentSigner?: PaymentSigner;
  /** Custom retry policy (defaults to DefaultRetryPolicy). */
  retryPolicy?: RetryPolicy;
  /** Custom receipt archive (defaults to MemoryReceiptStore). */
  receiptStore?: ReceiptStore;
  /** Custom fetch cache (defaults to MemoryFetchCache). */
  fetchCache?: FetchCache;
  /** Custom budget tracker (defaults to InMemoryBudgetTracker). */
  budgetTracker?: BudgetTracker;

  // ── Observability hooks ────────────────────────────────────────
  onPayment?: (event: PaymentEvent) => void | Promise<void>;
  onSkip?: (event: SkipEvent) => void | Promise<void>;
  onError?: (event: ErrorEvent) => void | Promise<void>;
  onBudgetWarning?: (event: BudgetWarningEvent) => void | Promise<void>;
  onBudgetExhausted?: () => void | Promise<void>;
}

export interface FetchOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  /** Bypass the FetchCache for this call. */
  noCache?: boolean;
}

export interface FetchResult<T = unknown> {
  url: string;
  status: number;
  /** Parsed JSON body (or raw text if not JSON). */
  data: T;
  /** Atomic USDC actually paid. 0n when served from cache or when the endpoint was free. */
  paid: AtomicUsdc;
  /** CrawlPayReceipt from the `X-PAYMENT-RESPONSE` header, when the server is CrawlPay-aware. */
  receipt: CrawlPayReceipt | null;
  /** True when served from FetchCache without a network round-trip. */
  cached: boolean;
  /** On-chain tx hash (x402) or session id (mpp) carried by the receipt. */
  settlementRef?: string;
}

export interface PaymentEvent {
  url: string;
  amount: AtomicUsdc;
  publisherWallet: StellarAddress;
  receipt: CrawlPayReceipt | null;
  settlementRef: string;
  durationMs: number;
}

export interface SkipEvent {
  url: string;
  reason: 'cache' | 'free-endpoint' | 'price-cap' | 'budget-cap';
  /** Set for cache + free-endpoint outcomes. */
  cached?: boolean;
  /** Set for price-cap and budget-cap. */
  price?: AtomicUsdc;
}

export interface ErrorEvent {
  url: string;
  error: Error;
  phase: 'fetch-offer' | 'sign' | 'send' | 'verify-receipt' | 'parse-response';
  attempt: number;
}

export interface BudgetWarningEvent {
  spentAtomic: AtomicUsdc;
  remainingAtomic: AtomicUsdc;
  ratio: number;
}

// ── Errors ───────────────────────────────────────────────────────

export class MaxPriceExceededError extends Error {
  constructor(
    public readonly url: string,
    public readonly offered: AtomicUsdc,
    public readonly max: AtomicUsdc,
  ) {
    super(`Offered price ${offered} for ${url} exceeds maxPerRequest ${max}`);
    this.name = 'MaxPriceExceededError';
  }
}

export class BudgetExhaustedError extends Error {
  constructor(
    public readonly url: string,
    public readonly needed: AtomicUsdc,
    public readonly remaining: AtomicUsdc,
  ) {
    super(`Daily budget exhausted: need ${needed} for ${url}, ${remaining} remaining`);
    this.name = 'BudgetExhaustedError';
  }
}

export class NoPayableOfferError extends Error {
  constructor(public readonly url: string) {
    super(`No payable x402 option in the 402 offer from ${url}`);
    this.name = 'NoPayableOfferError';
  }
}

export class PaymentRejectedError extends Error {
  constructor(
    public readonly url: string,
    public readonly code: CrawlPayErrorCode | string,
    public readonly attempt: number,
  ) {
    super(`Payment rejected for ${url}: ${code} (attempt ${attempt})`);
    this.name = 'PaymentRejectedError';
  }
}

export class ReceiptVerificationError extends Error {
  constructor(
    public readonly url: string,
    public readonly reason: string,
  ) {
    super(`Receipt from ${url} failed verification: ${reason}`);
    this.name = 'ReceiptVerificationError';
  }
}
