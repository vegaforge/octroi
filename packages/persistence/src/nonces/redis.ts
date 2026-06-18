import type Redis from 'ioredis';
import type { NonceTracker } from './interface';

/** Redis-backed nonce tracker. SET ... EX ttl NX is atomic: sets only if absent, TTL handles expiry. Returns 'OK' on first reserve, null on collision. */
export class RedisNonceTracker implements NonceTracker {
  readonly #redis: Redis;
  readonly #prefix: string;

  constructor(redis: Redis, prefix = 'octroi:nonce:') {
    this.#redis = redis;
    this.#prefix = prefix;
  }

  async reserve(nonce: string, expiresAtUnix: number): Promise<boolean> {
    const ttl = Math.max(1, expiresAtUnix - Math.floor(Date.now() / 1000));
    const result = await this.#redis.set(this.#key(nonce), '1', 'EX', ttl, 'NX');
    return result === 'OK';
  }

  async isUsed(nonce: string): Promise<boolean> {
    const exists = await this.#redis.exists(this.#key(nonce));
    return exists === 1;
  }

  async release(nonce: string): Promise<void> {
    await this.#redis.del(this.#key(nonce));
  }

  #key(nonce: string): string {
    return `${this.#prefix}${nonce}`;
  }
}
