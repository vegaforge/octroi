import { describe, it, expect } from 'vitest';
import { Keypair } from '@stellar/stellar-base';
import type { AssetId, OctroiReceipt, OctroiReceiptBody, StellarAddress } from '@octroi/types';
import {
  StellarKeypairReceiptSigner,
  canonicalizeReceipt,
  canonicalReceiptBytes,
  signReceipt,
  verifyReceipt,
} from '../index';

const PUBLISHER = Keypair.random().publicKey() as StellarAddress;
const CRAWLER = Keypair.random().publicKey() as StellarAddress;
const FACILITATOR_PUBKEY = Keypair.random().publicKey() as StellarAddress;
const USDC: AssetId = 'USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

function makeUnsignedBody(): Omit<OctroiReceiptBody, 'facilitatorPubkey'> {
  return {
    version: '1',
    resource: 'https://example.com/articles/how-soroban-works',
    amount: '1000',
    asset: USDC,
    network: 'stellar-testnet',
    from: CRAWLER,
    to: PUBLISHER,
    nonce: '8f2ac41d8f2ac41d8f2ac41d8f2ac41d',
    timestamp: '2026-06-16T12:00:00Z',
    settlement: 'x402',
    onchainTxHash: 'a1b2c3d4e5f6',
    mppSessionRef: null,
  };
}

describe('canonicalizeReceipt', () => {
  it('orders keys lexicographically', () => {
    const body: OctroiReceiptBody = {
      ...makeUnsignedBody(),
      facilitatorPubkey: FACILITATOR_PUBKEY,
    };
    const keys = topLevelKeys(canonicalizeReceipt(body));
    expect(keys).toEqual([...keys].sort());
  });

  it('excludes the signature field even when present', () => {
    const signed = {
      ...makeUnsignedBody(),
      facilitatorPubkey: FACILITATOR_PUBKEY,
      signature: 'c2lnbmF0dXJl',
    } as unknown as OctroiReceipt;
    const out = canonicalizeReceipt(signed);
    expect(out).not.toContain('signature');
    expect(out).not.toContain('c2lnbmF0dXJl');
  });

  it('keeps explicit null fields but is deterministic', () => {
    const body: OctroiReceiptBody = {
      ...makeUnsignedBody(),
      facilitatorPubkey: FACILITATOR_PUBKEY,
    };
    const out = canonicalizeReceipt(body);
    expect(out).toContain('"mppSessionRef":null');
    expect(canonicalizeReceipt(body)).toBe(out);
  });
});

describe('canonicalReceiptBytes', () => {
  it('changes when any field changes', () => {
    const a: OctroiReceiptBody = { ...makeUnsignedBody(), facilitatorPubkey: FACILITATOR_PUBKEY };
    const b: OctroiReceiptBody = { ...a, amount: '2000' };
    expect(Buffer.from(canonicalReceiptBytes(a)).toString('hex')).not.toBe(
      Buffer.from(canonicalReceiptBytes(b)).toString('hex'),
    );
  });
});

describe('signReceipt + verifyReceipt round-trip', () => {
  it('verifies a freshly-signed receipt', async () => {
    const kp = Keypair.random();
    const signer = new StellarKeypairReceiptSigner(kp.secret());
    const signed = await signReceipt(makeUnsignedBody(), signer);

    expect(signed.facilitatorPubkey).toBe(kp.publicKey());
    expect(signed.signature).toMatch(/^[A-Za-z0-9+/]+=*$/);

    const result = await verifyReceipt(signed);
    expect(result.valid).toBe(true);
    expect(result.signerPubkey).toBe(kp.publicKey());
  });

  it('rejects a receipt with a tampered field', async () => {
    const signer = new StellarKeypairReceiptSigner(Keypair.random().secret());
    const signed = await signReceipt(makeUnsignedBody(), signer);

    const tampered: OctroiReceipt = { ...signed, amount: '999999' };
    const result = await verifyReceipt(tampered);
    expect(result.valid).toBe(false);
  });

  it('rejects when expectedSigner does not match', async () => {
    const signer = new StellarKeypairReceiptSigner(Keypair.random().secret());
    const signed = await signReceipt(makeUnsignedBody(), signer);

    const other = Keypair.random().publicKey() as StellarAddress;
    const result = await verifyReceipt(signed, other);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/expected signer/);
  });

  it('two signers produce different signatures over the same body', async () => {
    const a = new StellarKeypairReceiptSigner(Keypair.random().secret());
    const b = new StellarKeypairReceiptSigner(Keypair.random().secret());
    const ra = await signReceipt(makeUnsignedBody(), a);
    const rb = await signReceipt(makeUnsignedBody(), b);
    expect(ra.signature).not.toBe(rb.signature);
    expect(ra.facilitatorPubkey).not.toBe(rb.facilitatorPubkey);
    expect((await verifyReceipt(ra)).valid).toBe(true);
    expect((await verifyReceipt(rb)).valid).toBe(true);
  });
});

function topLevelKeys(json: string): string[] {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`expected a JSON object, got ${json}`);
  }
  return Object.keys(parsed);
}
