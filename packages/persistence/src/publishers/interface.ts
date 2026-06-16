import type { AtomicUsdc, Network, StellarAddress } from '@crawlpay/types';

export interface PublisherRecord {
  id: string;
  domain: string;
  walletAddress: StellarAddress;
  network: Network;
  defaultPriceAtomic: AtomicUsdc;
  crawlpayAgentId?: string;
  /** sha256 of the publisher's API key. Never returned in API responses. */
  apiKeyHash?: string;
  description?: string;
  minReputationScore: number;
  robotsTxtAware: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePublisherInput {
  id: string;
  domain: string;
  walletAddress: StellarAddress;
  network: Network;
  defaultPriceAtomic?: AtomicUsdc;
  crawlpayAgentId?: string;
  apiKeyHash?: string;
  description?: string;
  minReputationScore?: number;
  robotsTxtAware?: boolean;
  active?: boolean;
}

export interface PublisherFilter {
  active?: boolean;
  network?: Network;
  limit?: number;
  offset?: number;
}

export interface PublisherRepository {
  create(input: CreatePublisherInput): Promise<PublisherRecord>;
  get(id: string): Promise<PublisherRecord | null>;
  getByDomain(domain: string): Promise<PublisherRecord | null>;
  getByApiKeyHash(apiKeyHash: string): Promise<PublisherRecord | null>;
  list(filter?: PublisherFilter): Promise<PublisherRecord[]>;
  count(filter?: PublisherFilter): Promise<number>;
}

/** Thrown by create() when id or domain already exists. */
export class PublisherAlreadyExistsError extends Error {
  constructor(
    public readonly field: 'id' | 'domain',
    public readonly value: string,
  ) {
    super(`Publisher with ${field}="${value}" already exists`);
    this.name = 'PublisherAlreadyExistsError';
  }
}
