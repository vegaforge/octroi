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

  async get(url: string, maxAgeSeconds: number): Promise<FetchCacheEntry | null> {
    const entry = this.#entries.get(url);
    if (!entry) return null;
    if (this.#now() - entry.cachedAt > maxAgeSeconds) {
      this.#entries.delete(url);
      return null;
    }
    return entry;
  }

  async put(entry: FetchCacheEntry): Promise<void> {
    this.#entries.set(entry.url, entry);
  }

  async invalidate(url: string): Promise<void> {
    this.#entries.delete(url);
  }

  async clear(): Promise<void> {
    this.#entries.clear();
  }
}
