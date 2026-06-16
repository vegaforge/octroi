import type {
  AssetId,
  ContractAddress,
  CrawlPayErrorCode,
  Network,
  PaymentPayload,
  StellarAddress,
} from '@crawlpay/types';

export interface SettleInput {
  /** The crawler's `X-PAYMENT` payload (signed auth entry or MPP debit). */
  payment: PaymentPayload;
  /** Publisher payout address the SAC transfer must pay. */
  payTo: StellarAddress;
  /** USDC asset the transfer must move. */
  asset: AssetId;
  /** Network the settlement must occur on. */
  network: Network;
  /** offered ceiling, authorized amount must not exceed this */
  maxAmountRequired: string;
}

export type SettleResult =
  | {
      ok: true;
      /** Crawler G-address that paid (the SAC transfer `from`). */
      from: StellarAddress;
      /** Amount actually settled, atomic USDC stringified. */
      amount: string;
      /** Authorization nonce, the replay barrier key. */
      nonce: string;
      /** SAC transfer hash for x402; null until bulk settlement for mpp. */
      onchainTxHash: string | null;
    }
  | { ok: false; error: { code: CrawlPayErrorCode; message: string } };

/** Settles a verified payment on Stellar by submitting the USDC SAC transfer. */
export interface SorobanSettlement {
  settle(input: SettleInput): Promise<SettleResult>;
}

const SETTLEMENT_PENDING =
  'Soroban USDC SAC settlement is not implemented in this build. This is the v0 ' +
  'Stellar settlement track. See the repository issues.';

/** Default Stellar settlement. settle() lands in the v0 settlement track. */
export class StellarSorobanSettlement implements SorobanSettlement {
  readonly #rpcUrl: string;
  readonly #network: Network;
  readonly #sacAddress: ContractAddress;
  readonly #feeSponsorSeed?: string;

  constructor(opts: {
    rpcUrl: string;
    network: Network;
    sacAddress: ContractAddress;
    feeSponsorSeed?: string;
  }) {
    this.#rpcUrl = opts.rpcUrl;
    this.#network = opts.network;
    this.#sacAddress = opts.sacAddress;
    this.#feeSponsorSeed = opts.feeSponsorSeed;
  }

  get network(): Network {
    return this.#network;
  }

  get sacAddress(): ContractAddress {
    return this.#sacAddress;
  }

  get rpcUrl(): string {
    return this.#rpcUrl;
  }

  get feeSponsored(): boolean {
    return this.#feeSponsorSeed !== undefined;
  }

  async settle(_input: SettleInput): Promise<SettleResult> {
    throw new Error(SETTLEMENT_PENDING);
  }
}
