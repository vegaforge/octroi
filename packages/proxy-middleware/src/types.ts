import type {
  AssetId,
  AtomicUsdc,
  OctroiReceipt,
  Network,
  PricingRule,
  StellarAddress,
} from '@octroi/types';
import type { BotClassifier, ClassificationResult } from './classifier';
import type { FacilitatorClient } from './facilitator';
import type { PricingResolver } from './pricing';
import type { SignatureVerifier } from './signature-verifier';

export interface OctroiMiddlewareConfig {
  /** Publisher catalog identifier (e.g. "pub_abc123"). */
  publisherId: string;
  /** Publisher's payout G-address. */
  publisherWallet: StellarAddress;
  /** USDC asset identifier (`USDC:ISSUER`) the publisher is paid in. */
  asset: AssetId;
  /** Network the publisher wants to be paid on. */
  network: Network;
  /** Base URL of the facilitator that verifies payments and signs receipts. */
  facilitatorUrl: string;
  /** Default per-request price when no pricing rule matches. */
  defaultPrice: AtomicUsdc;
  /** Per-path glob pricing rules. Evaluated in declaration order; first match wins. */
  pricingRules?: PricingRule[];
  /** Optional octroi_registry agent id; surfaced in the 402 offer. */
  octroiAgentId?: string;
  /** Description shown in the 402 offer (e.g. "Premium research articles"). */
  description?: string;

  // pluggable dependencies
  /** Override the default heuristic bot classifier. */
  botClassifier?: BotClassifier;
  /** Override the default facilitator client (HTTP to `facilitatorUrl`). */
  facilitator?: FacilitatorClient;
  /** Override the default pricing resolver (replaces pricingRules + defaultPrice). */
  pricingResolver?: PricingResolver;
  /** Verify Web Bot Auth signatures on crawler requests. When set, priced paths require a valid signature. */
  signatureVerifier?: SignatureVerifier;

  // observability hooks
  onPayment?: (event: PaymentEvent) => void | Promise<void>;
  onSkip?: (event: SkipEvent) => void | Promise<void>;
  onError?: (event: ErrorEvent) => void | Promise<void>;
}

export interface PaymentEvent {
  url: string;
  /** Crawler G-address that paid (the receipt `from`). */
  from: StellarAddress;
  amount: AtomicUsdc;
  receipt: OctroiReceipt;
  /** On-chain tx hash (x402) or session id (mpp). */
  settlementRef: string;
  durationMs: number;
}

export interface SkipEvent {
  url: string;
  reason: 'human' | 'free-path';
  classification?: ClassificationResult;
}

export interface ErrorEvent {
  url: string;
  error: Error;
  phase: 'classify' | 'price' | 'verify' | 'settle';
}
