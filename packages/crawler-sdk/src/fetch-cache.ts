import type { AtomicUsdc, OctroiReceipt } from '@octroi/types';

export interface FetchCacheEntry {
  url: string;
  status: number;
  /** Parsed JSON body (or raw string if not JSON). */
  data: unknown;
  receipt: OctroiReceipt | null;
  paid: AtomicUsdc;
  /** Unix seconds at which the entry was created. */
  cachedAt: number;
}

/**
 * Short-term content cache so we don't pay twice for the same URL in a window.
 * Auth nonces are single-use, so the cache stores content with the receipt (no payment replay).
 */
export interface FetchCache {
  /** Return a cache entry if present AND within `maxAgeSeconds`, else null. */
  get(url: string, maxAgeSeconds: number): Promise<FetchCacheEntry | null>;
  put(entry: FetchCacheEntry): Promise<void>;
  invalidate(url: string): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryFetchCache implements FetchCache {
  readonly #entries = new Map<string, FetchCacheEntry>();
  readonly #now: () => number;

  constructor(now: () => number = () => Math.floor(Date.now() / 1000)) {
    this.#now = now;
  }

  get(url: string, maxAgeSeconds: number): Promise<FetchCacheEntry | null> {
    const entry = this.#entries.get(url);
    if (!entry) return Promise.resolve(null);
    if (this.#now() - entry.cachedAt > maxAgeSeconds) {
      this.#entries.delete(url);
      return Promise.resolve(null);
    }
    return Promise.resolve(entry);
  }

  put(entry: FetchCacheEntry): Promise<void> {
    this.#entries.set(entry.url, entry);
    return Promise.resolve();
  }

  invalidate(url: string): Promise<void> {
    this.#entries.delete(url);
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.#entries.clear();
    return Promise.resolve();
  }
}
