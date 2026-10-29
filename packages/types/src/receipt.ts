import type { AssetId, Ed25519Signature, Network, StellarAddress } from './primitives';
import { NETWORKS, isStellarAddress } from './primitives';
import type { SettlementModel } from './x402';

export const OCTROI_RECEIPT_VERSION = '1' as const;
export type OctroiReceiptVersion = typeof OCTROI_RECEIPT_VERSION;

/** Session coordinates for an MPP-settled receipt. */
export interface MppSessionRef {
  sessionId: string;
  sequence: number;
}

/**
 * Unsigned receipt body, canonicalized for signing. Field order here is not significant;
 * the canonicalizer sorts keys before hashing. Same shape covers x402 and MPP settlement.
 */
export interface OctroiReceiptBody {
  version: OctroiReceiptVersion;
  resource: string;
  /** Atomic USDC, stringified. */
  amount: string;
  asset: AssetId;
  network: Network;
  /** Crawler G-address (the SAC transfer `from`). */
  from: StellarAddress;
  /** Publisher G-address (the SAC transfer `to`). */
  to: StellarAddress;
  /** Authorization-entry nonce (x402) or per-debit nonce (mpp). */
  nonce: string;
  /** ISO 8601 UTC timestamp the receipt was issued. */
  timestamp: string;
  settlement: SettlementModel;
  /** SAC transfer hash for x402; null until bulk settlement for mpp. */
  onchainTxHash: string | null;
  /** Session reference for mpp; null for x402. */
  mppSessionRef: MppSessionRef | null;
  /** G-address of the facilitator key that signed this receipt. */
  facilitatorPubkey: StellarAddress;
}

/** Receipt body plus the facilitator's Ed25519 signature. Portable proof-of-access, verifiable from the receipt alone. */
export interface OctroiReceipt extends OctroiReceiptBody {
  /** Base64 Ed25519 signature over the canonical body. */
  signature: Ed25519Signature;
}

const ASSET_ID_RE = /^[A-Za-z0-9]{1,12}:G[A-Z2-7]{55}$/;
const ATOMIC_AMOUNT_RE = /^\d+$/;

function malformed(reason: string): TypeError {
  return new TypeError(`malformed receipt: ${reason}`);
}

function requireString(fields: Record<string, unknown>, key: string): string {
  const value = fields[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw malformed(`\`${key}\` must be a non-empty string`);
  }
  return value;
}

function requireAddress(fields: Record<string, unknown>, key: string): StellarAddress {
  const value = requireString(fields, key);
  if (!isStellarAddress(value)) throw malformed(`\`${key}\` must be a Stellar G-address`);
  return value;
}

function parseMppSessionRef(value: unknown): MppSessionRef | null {
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw malformed('`mppSessionRef` must be null or an object');
  }
  const ref = value as Record<string, unknown>;
  if (typeof ref.sessionId !== 'string' || ref.sessionId.length === 0) {
    throw malformed('`mppSessionRef.sessionId` must be a non-empty string');
  }
  if (typeof ref.sequence !== 'number' || !Number.isInteger(ref.sequence) || ref.sequence < 0) {
    throw malformed('`mppSessionRef.sequence` must be a non-negative integer');
  }
  return { sessionId: ref.sessionId, sequence: ref.sequence };
}

/**
 * Check that a decoded value (for example the JSON in an `X-PAYMENT-RESPONSE` header) has
 * the shape of a signed receipt, and return it typed. Throws a `TypeError` that starts with
 * "malformed receipt" and names the first bad field. Only the receipt fields are copied, so
 * unknown extra keys are dropped. This checks shape only; call `verifyReceipt` from
 * `@octroi/receipt-signer` to check the signature.
 */
export function parseOctroiReceipt(value: unknown): OctroiReceipt {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw malformed('expected a JSON object');
  }
  const fields = value as Record<string, unknown>;

  if (fields.version !== OCTROI_RECEIPT_VERSION) {
    throw malformed(`\`version\` must be "${OCTROI_RECEIPT_VERSION}"`);
  }
  const amount = requireString(fields, 'amount');
  if (!ATOMIC_AMOUNT_RE.test(amount)) {
    throw malformed('`amount` must be an integer string of atomic USDC');
  }
  const asset = requireString(fields, 'asset');
  if (!ASSET_ID_RE.test(asset)) throw malformed('`asset` must be CODE:ISSUER');
  const network = fields.network;
  if (typeof network !== 'string' || !(NETWORKS as readonly string[]).includes(network)) {
    throw malformed(`\`network\` must be one of ${NETWORKS.join(', ')}`);
  }
  const settlement = fields.settlement;
  if (settlement !== 'x402' && settlement !== 'mpp') {
    throw malformed('`settlement` must be "x402" or "mpp"');
  }
  const onchainTxHash = fields.onchainTxHash;
  if (onchainTxHash !== null && (typeof onchainTxHash !== 'string' || onchainTxHash === '')) {
    throw malformed('`onchainTxHash` must be null or a non-empty string');
  }

  return {
    version: OCTROI_RECEIPT_VERSION,
    resource: requireString(fields, 'resource'),
    amount,
    asset: asset as AssetId,
    network: network as Network,
    from: requireAddress(fields, 'from'),
    to: requireAddress(fields, 'to'),
    nonce: requireString(fields, 'nonce'),
    timestamp: requireString(fields, 'timestamp'),
    settlement,
    onchainTxHash,
    mppSessionRef: parseMppSessionRef(fields.mppSessionRef),
    facilitatorPubkey: requireAddress(fields, 'facilitatorPubkey'),
    signature: requireString(fields, 'signature') as Ed25519Signature,
  };
}
