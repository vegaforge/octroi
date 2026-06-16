import { Keypair } from '@stellar/stellar-base';
import type {
  CrawlPayReceipt,
  CrawlPayReceiptBody,
  Ed25519Signature,
  StellarAddress,
} from '@crawlpay/types';
import { canonicalizeReceipt } from './canonicalize';

/** Pluggable signing surface so prod can swap in a KMS/HSM-backed Ed25519 signer. */
export interface ReceiptSigner {
  /** G-address of the signing key, embedded in receipts as `facilitatorPubkey`. */
  readonly publicKey: StellarAddress;
  /** Sign a message with the facilitator's Ed25519 key; returns a base64 signature. */
  sign(message: Uint8Array): Promise<Ed25519Signature>;
}

/** Signs with an in-memory Stellar keypair. Swap for a KMS/HSM signer in prod. */
export class StellarKeypairReceiptSigner implements ReceiptSigner {
  readonly publicKey: StellarAddress;
  readonly #keypair: Keypair;

  constructor(secretSeed: string) {
    this.#keypair = Keypair.fromSecret(secretSeed);
    this.publicKey = this.#keypair.publicKey() as StellarAddress;
  }

  async sign(message: Uint8Array): Promise<Ed25519Signature> {
    return this.#keypair.sign(Buffer.from(message)).toString('base64') as Ed25519Signature;
  }
}

/** Signing preimage: UTF-8 bytes of the canonical receipt JSON. Ed25519 hashes internally, so no pre-digest. */
export function canonicalReceiptBytes(body: CrawlPayReceiptBody): Uint8Array {
  return new TextEncoder().encode(canonicalizeReceipt(body));
}

/** Sign a receipt body. Embeds the signer's key as `facilitatorPubkey` so verifiers need only the receipt. */
export async function signReceipt(
  body: Omit<CrawlPayReceiptBody, 'facilitatorPubkey'>,
  signer: ReceiptSigner,
): Promise<CrawlPayReceipt> {
  const withPubkey: CrawlPayReceiptBody = {
    ...body,
    facilitatorPubkey: signer.publicKey,
  };
  const signature = await signer.sign(canonicalReceiptBytes(withPubkey));
  return { ...withPubkey, signature };
}
