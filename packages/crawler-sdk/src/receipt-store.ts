import type { OctroiReceipt, StellarAddress } from '@octroi/types';

export interface ReceiptFilter {
  /** Inclusive lower bound on receipt.timestamp (ISO 8601). */
  fromTimestamp?: string;
  /** Inclusive upper bound on receipt.timestamp (ISO 8601). */
  toTimestamp?: string;
  /** Crawler G-address (receipt `from`). */
  from?: StellarAddress;
  /** Publisher payout G-address (receipt `to`). */
  to?: StellarAddress;
  /** Max number of results to return. */
  limit?: number;
}

/**
 * Long-term receipt archive (append-only audit log for spend history).
 * Distinct from FetchCache, which is a short-lived content cache to skip re-payment.
 */
export interface ReceiptStore {
  put(receipt: OctroiReceipt): Promise<void>;
  /** Look up by authorization nonce (unique per payment). */
  getByNonce(nonce: string): Promise<OctroiReceipt | null>;
  list(filter?: ReceiptFilter): Promise<OctroiReceipt[]>;
  /** Count receipts matching the filter (cheaper than `list().length` for DB-backed impls). */
  count(filter?: ReceiptFilter): Promise<number>;
}

/** In-memory receipt store, for tests and short-lived scripts. */
export class MemoryReceiptStore implements ReceiptStore {
  readonly #byNonce = new Map<string, OctroiReceipt>();

  put(receipt: OctroiReceipt): Promise<void> {
    this.#byNonce.set(receipt.nonce, receipt);
    return Promise.resolve();
  }

  getByNonce(nonce: string): Promise<OctroiReceipt | null> {
    return Promise.resolve(this.#byNonce.get(nonce) ?? null);
  }

  list(filter: ReceiptFilter = {}): Promise<OctroiReceipt[]> {
    let out = Array.from(this.#byNonce.values()).filter((r) => matches(r, filter));
    out.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    if (filter.limit !== undefined) out = out.slice(0, filter.limit);
    return Promise.resolve(out);
  }

  count(filter: ReceiptFilter = {}): Promise<number> {
    let n = 0;
    for (const r of this.#byNonce.values()) {
      if (matches(r, filter)) n += 1;
    }
    return Promise.resolve(n);
  }
}

function matches(r: OctroiReceipt, f: ReceiptFilter): boolean {
  if (f.fromTimestamp !== undefined && r.timestamp < f.fromTimestamp) return false;
  if (f.toTimestamp !== undefined && r.timestamp > f.toTimestamp) return false;
  if (f.from !== undefined && r.from !== f.from) return false;
  if (f.to !== undefined && r.to !== f.to) return false;
  return true;
}
