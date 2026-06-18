import type { OctroiReceipt, StellarAddress } from '@octroi/types';

/** Signed receipt plus `publisherId`. publisherId is storage context, not part of the signed body. */
export interface StoredReceipt extends OctroiReceipt {
  publisherId: string;
}

export interface ReceiptFilter {
  publisherId?: string;
  /** Crawler G-address (the receipt `from`). */
  from?: StellarAddress;
  /** Publisher payout G-address (the receipt `to`). */
  to?: StellarAddress;
  /** ISO 8601 inclusive lower bound on the receipt timestamp. */
  fromTimestamp?: string;
  /** ISO 8601 inclusive upper bound on the receipt timestamp. */
  toTimestamp?: string;
  limit?: number;
  offset?: number;
}

/** Append-only receipt store; receipts are immutable once issued. onchainTxHash is backfilled out-of-band. */
export interface ReceiptRepository {
  insert(receipt: OctroiReceipt, publisherId: string): Promise<void>;
  getByNonce(nonce: string): Promise<StoredReceipt | null>;
  list(filter?: ReceiptFilter): Promise<StoredReceipt[]>;
  count(filter?: ReceiptFilter): Promise<number>;
}
