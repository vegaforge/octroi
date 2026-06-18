import type { Pool } from 'pg';
import type {
  AssetId,
  OctroiReceipt,
  Ed25519Signature,
  Network,
  SettlementModel,
  StellarAddress,
} from '@octroi/types';
import type { ReceiptFilter, ReceiptRepository, StoredReceipt } from './interface';

interface ReceiptRow {
  nonce: string;
  publisher_id: string;
  from_wallet: string;
  to_wallet: string;
  resource: string;
  /** BIGINT comes back as string from pg to preserve precision. */
  amount_atomic: string;
  asset: string;
  network: string;
  settlement: string;
  onchain_tx_hash: string | null;
  mpp_session_id: string | null;
  mpp_sequence: number | null;
  facilitator_pubkey: string;
  signature: string;
  issued_at: string;
}

/**
 * Postgres-backed receipt repo. Insert uses ON CONFLICT (nonce) DO NOTHING:
 * nonce is already gated by the NonceTracker before settle, so a dup here is just an
 * inter-instance race, no-op'd silently. onchain_tx_hash is backfilled by a separate worker.
 */
export class PostgresReceiptRepository implements ReceiptRepository {
  readonly #pool: Pool;

  constructor(pool: Pool) {
    this.#pool = pool;
  }

  async insert(receipt: OctroiReceipt, publisherId: string): Promise<void> {
    await this.#pool.query(
      `INSERT INTO receipts (
         nonce, publisher_id, from_wallet, to_wallet, resource, amount_atomic,
         asset, network, settlement, onchain_tx_hash, mpp_session_id,
         mpp_sequence, facilitator_pubkey, signature, issued_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (nonce) DO NOTHING`,
      [
        receipt.nonce,
        publisherId,
        receipt.from,
        receipt.to,
        receipt.resource,
        receipt.amount,
        receipt.asset,
        receipt.network,
        receipt.settlement,
        receipt.onchainTxHash,
        receipt.mppSessionRef?.sessionId ?? null,
        receipt.mppSessionRef?.sequence ?? null,
        receipt.facilitatorPubkey,
        receipt.signature,
        receipt.timestamp,
      ],
    );
  }

  async getByNonce(nonce: string): Promise<StoredReceipt | null> {
    const { rows } = await this.#pool.query<ReceiptRow>('SELECT * FROM receipts WHERE nonce = $1', [
      nonce,
    ]);
    return rows[0] ? rowToReceipt(rows[0]) : null;
  }

  async list(filter: ReceiptFilter = {}): Promise<StoredReceipt[]> {
    const { sql, params } = buildWhere(filter);
    const limit = filter.limit !== undefined ? ` LIMIT ${asPositiveInt(filter.limit)}` : '';
    const offset = filter.offset !== undefined ? ` OFFSET ${asPositiveInt(filter.offset)}` : '';
    const { rows } = await this.#pool.query<ReceiptRow>(
      `SELECT * FROM receipts${sql} ORDER BY issued_at DESC${limit}${offset}`,
      params,
    );
    return rows.map(rowToReceipt);
  }

  async count(filter: ReceiptFilter = {}): Promise<number> {
    const { sql, params } = buildWhere(filter);
    const { rows } = await this.#pool.query<{ count: string }>(
      `SELECT COUNT(*)::bigint AS count FROM receipts${sql}`,
      params,
    );
    return Number(rows[0]?.count ?? 0);
  }
}

function buildWhere(filter: ReceiptFilter): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const clauses: string[] = [];

  if (filter.publisherId !== undefined) {
    params.push(filter.publisherId);
    clauses.push(`publisher_id = $${params.length}`);
  }
  if (filter.from !== undefined) {
    params.push(filter.from);
    clauses.push(`from_wallet = $${params.length}`);
  }
  if (filter.to !== undefined) {
    params.push(filter.to);
    clauses.push(`to_wallet = $${params.length}`);
  }
  if (filter.fromTimestamp !== undefined) {
    params.push(filter.fromTimestamp);
    clauses.push(`issued_at >= $${params.length}`);
  }
  if (filter.toTimestamp !== undefined) {
    params.push(filter.toTimestamp);
    clauses.push(`issued_at <= $${params.length}`);
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

function rowToReceipt(row: ReceiptRow): StoredReceipt {
  return {
    version: '1',
    publisherId: row.publisher_id,
    resource: row.resource,
    amount: row.amount_atomic,
    asset: row.asset as AssetId,
    network: row.network as Network,
    from: row.from_wallet as StellarAddress,
    to: row.to_wallet as StellarAddress,
    nonce: row.nonce,
    timestamp: new Date(row.issued_at).toISOString(),
    settlement: row.settlement as SettlementModel,
    onchainTxHash: row.onchain_tx_hash,
    mppSessionRef:
      row.mpp_session_id !== null
        ? { sessionId: row.mpp_session_id, sequence: row.mpp_sequence ?? 0 }
        : null,
    facilitatorPubkey: row.facilitator_pubkey as StellarAddress,
    signature: row.signature as Ed25519Signature,
  };
}
