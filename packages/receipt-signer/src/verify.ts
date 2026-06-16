import { Keypair, StrKey } from '@stellar/stellar-base';
import type { CrawlPayReceipt, StellarAddress } from '@crawlpay/types';
import { canonicalReceiptBytes } from './sign';

export interface VerificationResult {
  valid: boolean;
  /** The `facilitatorPubkey` the signature was checked against. */
  signerPubkey: StellarAddress;
  /** Set when `valid=false`. */
  reason?: string;
}

/**
 * Verify a receipt's Ed25519 signature against the embedded `facilitatorPubkey`
 * (no key recovery like ECDSA). If `expectedSigner` is given, it must match.
 * Never throws on a bad signature; returns a structured result with a reason.
 */
export async function verifyReceipt(
  receipt: CrawlPayReceipt,
  expectedSigner?: StellarAddress,
): Promise<VerificationResult> {
  const { signature, ...body } = receipt;
  const signerPubkey = body.facilitatorPubkey;

  if (!StrKey.isValidEd25519PublicKey(signerPubkey)) {
    return {
      valid: false,
      signerPubkey,
      reason: 'facilitatorPubkey is not a valid Stellar public key',
    };
  }

  if (expectedSigner && signerPubkey !== expectedSigner) {
    return {
      valid: false,
      signerPubkey,
      reason: `facilitatorPubkey is not the expected signer ${expectedSigner}`,
    };
  }

  let ok = false;
  try {
    const keypair = Keypair.fromPublicKey(signerPubkey);
    ok = keypair.verify(Buffer.from(canonicalReceiptBytes(body)), Buffer.from(signature, 'base64'));
  } catch {
    ok = false;
  }

  if (!ok) {
    return {
      valid: false,
      signerPubkey,
      reason: 'signature does not verify against facilitatorPubkey',
    };
  }

  return { valid: true, signerPubkey };
}
