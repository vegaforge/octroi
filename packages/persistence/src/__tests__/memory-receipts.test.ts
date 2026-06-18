import { describe, expect, it } from 'vitest';
import { Keypair } from '@stellar/stellar-base';
import type { AssetId, OctroiReceipt, StellarAddress } from '@octroi/types';
import { MemoryReceiptRepository } from '../receipts/memory';

const PUBLISHER_A = Keypair.random().publicKey() as StellarAddress;
const CRAWLER_A = Keypair.random().publicKey() as StellarAddress;
const CRAWLER_B = Keypair.random().publicKey() as StellarAddress;
const USDC: AssetId = 'USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

function nonceFrom(seed: number): string {
  return seed.toString(16).padStart(32, '0');
}

/** ISO timestamp from a unix seconds value. */
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
    from: CRAWLER_A,
    to: PUBLISHER_A,
    nonce: nonceFrom(1),
    timestamp: ts(1000),
    settlement: 'x402',
    onchainTxHash: 'a1b2c3',
    mppSessionRef: null,
    facilitatorPubkey: Keypair.random().publicKey() as StellarAddress,
    signature: 'c2ln' as OctroiReceipt['signature'],
    ...overrides,
  };
}

describe('MemoryReceiptRepository', () => {
  it('inserts and retrieves by nonce', async () => {
    const repo = new MemoryReceiptRepository();
    const r = makeReceipt({ nonce: nonceFrom(1) });
    await repo.insert(r, 'pub_a');
    expect(await repo.getByNonce(nonceFrom(1))).toEqual({ ...r, publisherId: 'pub_a' });
    expect(await repo.getByNonce(nonceFrom(2))).toBeNull();
  });

  it('lists in newest-first order', async () => {
    const repo = new MemoryReceiptRepository();
    await repo.insert(makeReceipt({ nonce: nonceFrom(1), timestamp: ts(1000) }), 'pub_a');
    await repo.insert(makeReceipt({ nonce: nonceFrom(2), timestamp: ts(3000) }), 'pub_a');
    await repo.insert(makeReceipt({ nonce: nonceFrom(3), timestamp: ts(2000) }), 'pub_a');

    const out = await repo.list();
    expect(out.map((r) => r.timestamp)).toEqual([ts(3000), ts(2000), ts(1000)]);
  });

  it('filters by publisherId / from / timestamp range', async () => {
    const repo = new MemoryReceiptRepository();
    await repo.insert(
      makeReceipt({ nonce: nonceFrom(1), from: CRAWLER_A, timestamp: ts(1000) }),
      'pub_a',
    );
    await repo.insert(
      makeReceipt({ nonce: nonceFrom(2), from: CRAWLER_A, timestamp: ts(2000) }),
      'pub_b',
    );
    await repo.insert(
      makeReceipt({ nonce: nonceFrom(3), from: CRAWLER_B, timestamp: ts(3000) }),
      'pub_a',
    );

    expect((await repo.list({ publisherId: 'pub_a' })).length).toBe(2);
    expect((await repo.list({ from: CRAWLER_B })).length).toBe(1);
    expect((await repo.list({ fromTimestamp: ts(1500), toTimestamp: ts(2500) })).length).toBe(1);
    expect(await repo.count({ publisherId: 'pub_a' })).toBe(2);
  });

  it('honors limit and offset', async () => {
    const repo = new MemoryReceiptRepository();
    for (let i = 0; i < 5; i += 1) {
      await repo.insert(makeReceipt({ nonce: nonceFrom(i + 1), timestamp: ts(1000 + i) }), 'pub_a');
    }
    const page = await repo.list({ limit: 2, offset: 1 });
    expect(page.length).toBe(2);
    expect(page.map((r) => r.timestamp)).toEqual([ts(1003), ts(1002)]);
  });
});
