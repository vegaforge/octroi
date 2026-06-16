import { createHash, randomBytes } from 'node:crypto';
import type { PublisherRecord, PublisherRepository } from '@crawlpay/persistence';

/** sha256 of an API key, hex-encoded. Only the hash is ever stored. */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/** Generate a fresh API key and its hash. The plaintext is shown to the caller once. */
export function generateApiKey(): { key: string; hash: string } {
  const key = `cpk_${randomBytes(24).toString('base64url')}`;
  return { key, hash: hashApiKey(key) };
}

export interface ApiKeyAuth {
  /** Resolve a publisher from an `Authorization: Bearer <key>` header, or null. */
  authenticate(authorizationHeader: string | undefined): Promise<PublisherRecord | null>;
}

/** Bearer-token auth: hashes the key and matches it against the stored api_key_hash. */
export class PublisherApiKeyAuth implements ApiKeyAuth {
  readonly #publishers: PublisherRepository;

  constructor(publishers: PublisherRepository) {
    this.#publishers = publishers;
  }

  async authenticate(authorizationHeader: string | undefined): Promise<PublisherRecord | null> {
    if (!authorizationHeader) return null;
    const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
    const key = match?.[1];
    if (!key) return null;
    return this.#publishers.getByApiKeyHash(hashApiKey(key));
  }
}
