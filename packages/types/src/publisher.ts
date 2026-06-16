import type { AtomicUsdc, Network, StellarAddress } from './primitives';

export interface PublisherConfig {
  id: string;
  domain: string;
  walletAddress: StellarAddress;
  crawlpayAgentId?: string;
  defaultPriceAtomic: AtomicUsdc;
  pricingRules?: PricingRule[];
  accessRules?: AccessRule[];
  minReputationScore?: number;
  robotsTxtAware?: boolean;
  active: boolean;
  network: Network;
}

export interface PricingRule {
  /** Glob pattern, evaluated in declaration order; first match wins. */
  pattern: string;
  priceAtomic: AtomicUsdc;
  /** Static per-path price (default) or a price computed per response. */
  mode?: 'static' | 'dynamic';
  /** Outcome for a request matching this rule. Defaults to `charge`. */
  policy?: 'allow' | 'charge' | 'block';
  /** Restrict this rule to a specific crawler G-address. */
  crawlerScope?: StellarAddress;
}

export interface AccessRule {
  type: 'allow' | 'block' | 'discount';
  crawlerWallet?: StellarAddress;
  minReputationScore?: number;
  maxReputationScore?: number;
  /** Discount in basis points (0 to 10000). */
  discountBps?: number;
}
