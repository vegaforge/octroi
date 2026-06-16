import type { CrawlPayErrorCode } from '@crawlpay/types';

export type RetryDecision = 'retry' | 'refresh-offer' | 'abort';

export interface RetryPolicy {
  /** Max attempts (including the first try) before giving up. */
  readonly maxAttempts: number;
  /** Decide what to do given an error code + the attempt number (1-indexed). */
  decide(errorCode: CrawlPayErrorCode | string, attempt: number): RetryDecision;
  /** Milliseconds to wait before attempt N (1-indexed). */
  backoffMs(attempt: number): number;
}

/**
 * Default retry policy keyed on the x402 error code table (PRD §9.7).
 * refresh-offer: auth is stale (bad sig, replay, expired), re-fetch and re-sign.
 * retry: transient infra (rate limit, 500). abort: terminal (no balance, banned).
 * Backoff is exponential from 500ms, capped at 60s.
 */
export class DefaultRetryPolicy implements RetryPolicy {
  readonly maxAttempts: number;

  constructor(maxAttempts = 3) {
    this.maxAttempts = maxAttempts;
  }

  decide(errorCode: CrawlPayErrorCode | string, attempt: number): RetryDecision {
    if (attempt >= this.maxAttempts) return 'abort';
    switch (errorCode) {
      case 'invalid_signature':
      case 'invalid_request_signature':
      case 'replay':
      case 'expired':
      case 'offer_changed':
      case 'session_budget_exhausted':
        return 'refresh-offer';
      case 'rate_limited':
      case 'facilitator_error':
      case 'facilitator_unavailable':
      case 'unexpected_error':
        return 'retry';
      case 'insufficient_balance':
      case 'reputation_too_low':
      case 'crawler_banned':
      case 'recipient_mismatch':
      case 'amount_exceeded':
      case 'invalid_payload':
        return 'abort';
      default:
        return 'abort';
    }
  }

  backoffMs(attempt: number): number {
    return Math.min(60_000, 500 * 2 ** (attempt - 1));
  }
}
