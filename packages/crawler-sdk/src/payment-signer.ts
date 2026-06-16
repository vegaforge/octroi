import { Keypair } from '@stellar/stellar-base';
import type {
  AtomicUsdc,
  Network,
  PaymentRequirement,
  StellarAddress,
  X402PaymentPayload,
} from '@crawlpay/types';

export interface CrawlerBalance {
  /** USDC available to spend, atomic. */
  available: AtomicUsdc;
}

/**
 * Signs payments for the crawler. Default signs a Soroban auth entry for the
 * offered USDC SAC transfer. Pluggable for a smart wallet or remote signer.
 */
export interface PaymentSigner {
  /** The crawler's Stellar G-address (payment account and identity). */
  readonly address: StellarAddress;
  /** Build and sign an `X-PAYMENT` payload for the offer (a Soroban auth entry). */
  createPayment(requirement: PaymentRequirement): Promise<X402PaymentPayload>;
  /** Read the crawler's spendable USDC balance. */
  getBalance(): Promise<CrawlerBalance>;
}

const SETTLEMENT_PENDING =
  'Soroban authorization-entry signing and USDC SAC settlement are not implemented in this build. ' +
  'This is the v0 Stellar settlement track. See the repository issues.';

/**
 * Default Stellar signer. Address is derived from the seed offline. Auth-entry
 * signing and balance reads need Soroban RPC (v0 settlement track).
 */
export class StellarPaymentSigner implements PaymentSigner {
  readonly address: StellarAddress;
  readonly #network: Network;
  readonly #keypair: Keypair;

  constructor(network: Network, secretSeed: string) {
    this.#network = network;
    this.#keypair = Keypair.fromSecret(secretSeed);
    this.address = this.#keypair.publicKey() as StellarAddress;
  }

  get network(): Network {
    return this.#network;
  }

  async createPayment(_requirement: PaymentRequirement): Promise<X402PaymentPayload> {
    throw new Error(SETTLEMENT_PENDING);
  }

  async getBalance(): Promise<CrawlerBalance> {
    throw new Error(SETTLEMENT_PENDING);
  }
}
