import type { NonceTracker } from './interface';

/**
 * In-process nonce tracker. Single-instance only; use RedisNonceTracker for multi-process.
 * Expired entries are swept lazily on each op, no timer.
 */
export class MemoryNonceTracker implements NonceTracker {
  readonly #entries = new Map<string, number>();
  readonly #now: () => number;

  constructor(now: () => number = () => Math.floor(Date.now() / 1000)) {
    this.#now = now;
  }

  reserve(nonce: string, expiresAtUnix: number): Promise<boolean> {
    this.#sweep();
    if (this.#entries.has(nonce)) return Promise.resolve(false);
    this.#entries.set(nonce, expiresAtUnix);
    return Promise.resolve(true);
  }

  isUsed(nonce: string): Promise<boolean> {
    this.#sweep();
    return Promise.resolve(this.#entries.has(nonce));
  }

  release(nonce: string): Promise<void> {
    this.#entries.delete(nonce);
    return Promise.resolve();
  }

  #sweep(): void {
    const now = this.#now();
    for (const [nonce, expiresAt] of this.#entries) {
      if (expiresAt < now) this.#entries.delete(nonce);
    }
  }
}
