import { describe, expect, it } from 'vitest';
import { Keypair } from '@stellar/stellar-base';
import type { AssetId, OctroiReceipt, StellarAddress } from '@octroi/types';
import { StellarKeypairReceiptSigner, signReceipt, verifyReceipt } from '@octroi/receipt-signer';
import { decodeReceiptHeader, encodeReceiptHeader } from '../receipts';

const PUBLISHER = Keypair.random().publicKey() as StellarAddress;
const CRAWLER = Keypair.random().publicKey() as StellarAddress;
const USDC: AssetId = 'USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

async function makeReceipt(): Promise<OctroiReceipt> {
  const signer = new StellarKeypairReceiptSigner(Keypair.random().secret());
  return signReceipt(
    {
      version: '1',
      resource: 'https://example.com/article',
      amount: '1000',
      asset: USDC,
      network: 'stellar-testnet',
      from: CRAWLER,
      to: PUBLISHER,
      nonce: 'abc123abc123abc123abc123abc123ab',
      timestamp: '2026-06-16T12:00:00Z',
      settlement: 'x402',
      onchainTxHash: 'a1b2c3',
      mppSessionRef: null,
    },
    signer,
  );
}

describe('encodeReceiptHeader / decodeReceiptHeader', () => {
  it('round-trips a signed receipt unchanged', async () => {
    const receipt = await makeReceipt();
    const encoded = encodeReceiptHeader(receipt);
    expect(encoded).toMatch(/^[A-Za-z0-9+/=]+$/);
    const decoded = decodeReceiptHeader(encoded);
    expect(decoded).toEqual(receipt);
  });

  it('a decoded receipt still verifies', async () => {
    const receipt = await makeReceipt();
    const decoded = decodeReceiptHeader(encodeReceiptHeader(receipt));
    expect((await verifyReceipt(decoded)).valid).toBe(true);
  });
});
