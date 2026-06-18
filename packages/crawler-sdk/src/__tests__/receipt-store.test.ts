import { describe, expect, it } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import type { AssetId, OctroiReceipt, StellarAddress } from '@octroi/types';
import { MemoryReceiptStore } from '../receipt-store';

const PUBLISHER_A = Keypair.random().publicKey() as StellarAddress;
const PUBLISHER_B = Keypair.random().publicKey() as StellarAddress;
const CRAWLER = Keypair.random().publicKey() as StellarAddress;
const USDC: AssetId = 'USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

function ts(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

function makeReceipt(overrides: Partial<OctroiReceipt> = {}): OctroiReceipt {
  return {
    version: '1',
    resource: 'https://example.com/x',
    amount: '1000',
    asset: USDC,
    network: 'stellar-testnet',
    from: CRAWLER,
    to: PUBLISHER_A,
    nonce: 'abc123abc123abc123abc123abc123ab',
    timestamp: ts(1000),
    settlement: 'x402',
    onchainTxHash: 'a1b2c3',
    mppSessionRef: null,
    facilitatorPubkey: Keypair.random().publicKey() as StellarAddress,
    signature: 'c2ln' as OctroiReceipt['signature'],
    ...overrides,
  };
}

describe('MemoryReceiptStore', () => {
  it('stores and retrieves a receipt by nonce', async () => {
    const store = new MemoryReceiptStore();
    const receipt = makeReceipt();
    await store.put(receipt);
    expect(await store.getByNonce(receipt.nonce)).toEqual(receipt);
  });

  it('returns null when no receipt matches the nonce', async () => {
    const store = new MemoryReceiptStore();
    expect(await store.getByNonce('does-not-exist')).toBeNull();
  });

  it('filters by publisher and timestamp range, sorted newest-first', async () => {
    const store = new MemoryReceiptStore();
    await store.put(makeReceipt({ nonce: 'n1', to: PUBLISHER_A, timestamp: ts(1000) }));
    await store.put(makeReceipt({ nonce: 'n2', to: PUBLISHER_B, timestamp: ts(2000) }));
    await store.put(makeReceipt({ nonce: 'n3', to: PUBLISHER_A, timestamp: ts(3000) }));

    const all = await store.list();
    expect(all.map((r) => r.timestamp)).toEqual([ts(3000), ts(2000), ts(1000)]);

    const aOnly = await store.list({ to: PUBLISHER_A });
    expect(aOnly).toHaveLength(2);
    expect(aOnly.every((r) => r.to === PUBLISHER_A)).toBe(true);

    const inRange = await store.list({ fromTimestamp: ts(1500), toTimestamp: ts(2500) });
    expect(inRange).toHaveLength(1);
    expect(inRange[0]!.timestamp).toBe(ts(2000));

    expect(await store.count({ to: PUBLISHER_A })).toBe(2);
  });

  it('respects the limit parameter', async () => {
    const store = new MemoryReceiptStore();
    for (let i = 0; i < 5; i += 1) {
      await store.put(makeReceipt({ nonce: `n${i}`, timestamp: ts(1000 + i) }));
    }
    const out = await store.list({ limit: 3 });
    expect(out).toHaveLength(3);
  });
});
