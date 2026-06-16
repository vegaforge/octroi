/**
 * Replay-protection store for Soroban auth-entry and Web Bot Auth nonces.
 * `reserve` must be atomic: only one caller wins a given nonce (Redis SETNX or a UNIQUE insert).
 * Reservations expire at `expiresAtUnix` so the store stays bounded.
 */
export interface NonceTracker {
  reserve(nonce: string, expiresAtUnix: number): Promise<boolean>;
  isUsed(nonce: string): Promise<boolean>;
  /** Manual release, rarely needed outside tests. */
  release(nonce: string): Promise<void>;
}
