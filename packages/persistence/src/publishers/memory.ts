import { atomicUsdc, type AtomicUsdc } from '@octroi/types';
import {
  PublisherAlreadyExistsError,
  type CreatePublisherInput,
  type PublisherFilter,
  type PublisherRecord,
  type PublisherRepository,
} from './interface';

const DEFAULT_PRICE = atomicUsdc(1000n);

/** In-memory publisher repo, single-instance only. */
export class MemoryPublisherRepository implements PublisherRepository {
  readonly #byId = new Map<string, PublisherRecord>();
  readonly #domainIndex = new Map<string, string>();
  readonly #now: () => Date;

  constructor(now: () => Date = () => new Date()) {
    this.#now = now;
  }

  create(input: CreatePublisherInput): Promise<PublisherRecord> {
    // Duplicates reject rather than throw, matching the Postgres repository.
    if (this.#byId.has(input.id)) {
      return Promise.reject(new PublisherAlreadyExistsError('id', input.id));
    }
    if (this.#domainIndex.has(input.domain)) {
      return Promise.reject(new PublisherAlreadyExistsError('domain', input.domain));
    }
    const now = this.#now();
    const record: PublisherRecord = {
      id: input.id,
      domain: input.domain,
      walletAddress: input.walletAddress,
      network: input.network,
      defaultPriceAtomic: input.defaultPriceAtomic ?? DEFAULT_PRICE,
      octroiAgentId: input.octroiAgentId,
      apiKeyHash: input.apiKeyHash,
      description: input.description,
      minReputationScore: input.minReputationScore ?? 0,
      robotsTxtAware: input.robotsTxtAware ?? true,
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.#byId.set(record.id, record);
    this.#domainIndex.set(record.domain, record.id);
    return Promise.resolve(record);
  }

  get(id: string): Promise<PublisherRecord | null> {
    return Promise.resolve(this.#byId.get(id) ?? null);
  }

  getByDomain(domain: string): Promise<PublisherRecord | null> {
    const id = this.#domainIndex.get(domain);
    return Promise.resolve(id ? (this.#byId.get(id) ?? null) : null);
  }

  getByApiKeyHash(apiKeyHash: string): Promise<PublisherRecord | null> {
    for (const p of this.#byId.values()) {
      if (p.apiKeyHash === apiKeyHash) return Promise.resolve(p);
    }
    return Promise.resolve(null);
  }

  list(filter: PublisherFilter = {}): Promise<PublisherRecord[]> {
    let out = Array.from(this.#byId.values()).filter((p) => matches(p, filter));
    out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    if (filter.offset !== undefined) out = out.slice(filter.offset);
    if (filter.limit !== undefined) out = out.slice(0, filter.limit);
    return Promise.resolve(out);
  }

  count(filter: PublisherFilter = {}): Promise<number> {
    let n = 0;
    for (const p of this.#byId.values()) {
      if (matches(p, filter)) n += 1;
    }
    return Promise.resolve(n);
  }
}

function matches(p: PublisherRecord, f: PublisherFilter): boolean {
  if (f.active !== undefined && p.active !== f.active) return false;
  if (f.network !== undefined && p.network !== f.network) return false;
  return true;
}

/** Typed default for callers that need it. */
export const _defaultPublisherPrice: AtomicUsdc = DEFAULT_PRICE;
