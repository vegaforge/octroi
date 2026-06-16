import type { AssetId, Ed25519Signature, Network, StellarAddress } from './primitives';
import type { SettlementModel } from './x402';

export const CRAWLPAY_RECEIPT_VERSION = '1' as const;
export type CrawlPayReceiptVersion = typeof CRAWLPAY_RECEIPT_VERSION;

/** Session coordinates for an MPP-settled receipt. */
export interface MppSessionRef {
  sessionId: string;
  sequence: number;
}

/**
 * Unsigned receipt body, canonicalized for signing. Field order here is not significant;
 * the canonicalizer sorts keys before hashing. Same shape covers x402 and MPP settlement.
 */
export interface CrawlPayReceiptBody {
  version: CrawlPayReceiptVersion;
  resource: string;
  /** Atomic USDC, stringified. */
  amount: string;
  asset: AssetId;
  network: Network;
  /** Crawler G-address (the SAC transfer `from`). */
  from: StellarAddress;
  /** Publisher G-address (the SAC transfer `to`). */
  to: StellarAddress;
  /** Authorization-entry nonce (x402) or per-debit nonce (mpp). */
  nonce: string;
  /** ISO 8601 UTC timestamp the receipt was issued. */
  timestamp: string;
  settlement: SettlementModel;
  /** SAC transfer hash for x402; null until bulk settlement for mpp. */
  onchainTxHash: string | null;
  /** Session reference for mpp; null for x402. */
  mppSessionRef: MppSessionRef | null;
  /** G-address of the facilitator key that signed this receipt. */
  facilitatorPubkey: StellarAddress;
}

/** Receipt body plus the facilitator's Ed25519 signature. Portable proof-of-access, verifiable from the receipt alone. */
export interface CrawlPayReceipt extends CrawlPayReceiptBody {
  /** Base64 Ed25519 signature over the canonical body. */
  signature: Ed25519Signature;
}
