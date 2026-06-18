import type { Pool } from 'pg';
import { atomicUsdc } from '@octroi/types';
import type { Network, StellarAddress } from '@octroi/types';
import {
  PublisherAlreadyExistsError,
  type CreatePublisherInput,
  type PublisherFilter,
  type PublisherRecord,
  type PublisherRepository,
} from './interface';

interface PublisherRow {
  id: string;
  domain: string;
  wallet_address: string;
  octroi_agent_id: string | null;
  api_key_hash: string | null;
  default_price_atomic: string;
  network: string;
  min_reputation_score: number;
  robots_txt_aware: boolean;
  active: boolean;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

const DEFAULT_PRICE_ATOMIC = 1000n;

export class PostgresPublisherRepository implements PublisherRepository {
  readonly #pool: Pool;

  constructor(pool: Pool) {
    this.#pool = pool;
  }

  async create(input: CreatePublisherInput): Promise<PublisherRecord> {
    try {
      const { rows } = await this.#pool.query<PublisherRow>(
        `INSERT INTO publishers (
           id, domain, wallet_address, octroi_agent_id, api_key_hash,
           default_price_atomic, network, min_reputation_score, robots_txt_aware,
           active, description
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          input.id,
          input.domain,
          input.walletAddress,
          input.octroiAgentId ?? null,
          input.apiKeyHash ?? null,
          input.defaultPriceAtomic !== undefined
            ? input.defaultPriceAtomic.toString()
            : DEFAULT_PRICE_ATOMIC.toString(),
          input.network,
          input.minReputationScore ?? 0,
          input.robotsTxtAware ?? true,
          input.active ?? true,
          input.description ?? null,
        ],
      );
      return rowToRecord(rows[0]!);
    } catch (err) {
      const pgErr = err as { code?: string; constraint?: string };
      if (pgErr.code === '23505') {
        if (pgErr.constraint?.includes('domain')) {
          throw new PublisherAlreadyExistsError('domain', input.domain);
        }
        throw new PublisherAlreadyExistsError('id', input.id);
      }
      throw err;
    }
  }

  async get(id: string): Promise<PublisherRecord | null> {
    const { rows } = await this.#pool.query<PublisherRow>(
      'SELECT * FROM publishers WHERE id = $1',
      [id],
    );
    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  async getByDomain(domain: string): Promise<PublisherRecord | null> {
    const { rows } = await this.#pool.query<PublisherRow>(
      'SELECT * FROM publishers WHERE domain = $1',
      [domain],
    );
    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  async getByApiKeyHash(apiKeyHash: string): Promise<PublisherRecord | null> {
    const { rows } = await this.#pool.query<PublisherRow>(
      'SELECT * FROM publishers WHERE api_key_hash = $1',
      [apiKeyHash],
    );
    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  async list(filter: PublisherFilter = {}): Promise<PublisherRecord[]> {
    const { sql, params } = buildWhere(filter);
    const limit = filter.limit !== undefined ? ` LIMIT ${asPositiveInt(filter.limit)}` : '';
    const offset = filter.offset !== undefined ? ` OFFSET ${asPositiveInt(filter.offset)}` : '';
    const { rows } = await this.#pool.query<PublisherRow>(
      `SELECT * FROM publishers${sql} ORDER BY created_at DESC${limit}${offset}`,
      params,
    );
    return rows.map(rowToRecord);
  }

  async count(filter: PublisherFilter = {}): Promise<number> {
    const { sql, params } = buildWhere(filter);
    const { rows } = await this.#pool.query<{ count: string }>(
      `SELECT COUNT(*)::bigint AS count FROM publishers${sql}`,
      params,
    );
    return Number(rows[0]?.count ?? 0);
  }
}

function buildWhere(filter: PublisherFilter): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const clauses: string[] = [];

  if (filter.active !== undefined) {
    params.push(filter.active);
    clauses.push(`active = $${params.length}`);
  }
  if (filter.network !== undefined) {
    params.push(filter.network);
    clauses.push(`network = $${params.length}`);
  }

  return {
    sql: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

function asPositiveInt(n: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`limit/offset must be a non-negative integer, got ${n}`);
  }
  return n;
}

function rowToRecord(row: PublisherRow): PublisherRecord {
  return {
    id: row.id,
    domain: row.domain,
    walletAddress: row.wallet_address as StellarAddress,
    network: row.network as Network,
    defaultPriceAtomic: atomicUsdc(BigInt(row.default_price_atomic)),
    octroiAgentId: row.octroi_agent_id ?? undefined,
    apiKeyHash: row.api_key_hash ?? undefined,
    description: row.description ?? undefined,
    minReputationScore: row.min_reputation_score,
    robotsTxtAware: row.robots_txt_aware,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
