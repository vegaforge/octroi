import type { OctroiReceipt } from '@octroi/types';
import type { ReceiptFilter, ReceiptRepository, StoredReceipt } from './interface';

/** In-memory receipt repo, single-instance only; use PostgresReceiptRepository in prod. */
export class MemoryReceiptRepository implements ReceiptRepository {
  readonly #byNonce = new Map<string, StoredReceipt>();

  insert(receipt: OctroiReceipt, publisherId: string): Promise<void> {
    if (!this.#byNonce.has(receipt.nonce)) {
      this.#byNonce.set(receipt.nonce, { ...receipt, publisherId });
    }
    return Promise.resolve();
  }

  getByNonce(nonce: string): Promise<StoredReceipt | null> {
    return Promise.resolve(this.#byNonce.get(nonce) ?? null);
  }

  list(filter: ReceiptFilter = {}): Promise<StoredReceipt[]> {
    let out = Array.from(this.#byNonce.values()).filter((r) => matches(r, filter));
    out.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    if (filter.offset !== undefined) out = out.slice(filter.offset);
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

function matches(r: StoredReceipt, f: ReceiptFilter): boolean {
  if (f.publisherId !== undefined && r.publisherId !== f.publisherId) return false;
  if (f.from !== undefined && r.from !== f.from) return false;
  if (f.to !== undefined && r.to !== f.to) return false;
  if (f.fromTimestamp !== undefined && r.timestamp < f.fromTimestamp) return false;
  if (f.toTimestamp !== undefined && r.timestamp > f.toTimestamp) return false;
  return true;
}
