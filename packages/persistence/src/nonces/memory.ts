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

  async reserve(nonce: string, expiresAtUnix: number): Promise<boolean> {
    this.#sweep();
    if (this.#entries.has(nonce)) return false;
    this.#entries.set(nonce, expiresAtUnix);
    return true;
  }

  async isUsed(nonce: string): Promise<boolean> {
    this.#sweep();
    return this.#entries.has(nonce);
  }

  async release(nonce: string): Promise<void> {
    this.#entries.delete(nonce);
  }

  #sweep(): void {
    const now = this.#now();
    for (const [nonce, expiresAt] of this.#entries) {
      if (expiresAt < now) this.#entries.delete(nonce);
    }
  }
}
