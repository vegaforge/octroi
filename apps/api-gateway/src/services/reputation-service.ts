import type { StellarAddress } from '@crawlpay/types';
import type { ReceiptRepository } from '@crawlpay/persistence';

export interface ReputationSummary {
  address: StellarAddress;
  /** True until the on-chain crawlpay_registry replaces this in v2. */
  provisional: true;
  /** Number of settlements this crawler has paid (the trust signal). */
  settledCount: number;
  /** Provisional score in [0, 100], monotonic in settledCount. */
  score: number;
}

export interface ReputationService {
  getReputation(address: StellarAddress): Promise<ReputationSummary>;
}

/** Reputation saturates as settlements accumulate; at this count the score is ~67. */
const HALF_SATURATION = 100;

// off-chain score from our own settlement history (PRD 11.4). centralized in v0,
// replaced by the on-chain crawlpay_registry in v2.
export class ProvisionalReputationService implements ReputationService {
  readonly #receipts: ReceiptRepository;

  constructor(receipts: ReceiptRepository) {
    this.#receipts = receipts;
  }

  async getReputation(address: StellarAddress): Promise<ReputationSummary> {
    const settledCount = await this.#receipts.count({ from: address });
    const score = Math.round((100 * settledCount) / (settledCount + HALF_SATURATION));
    return { address, provisional: true, settledCount, score };
  }
}
