import { describe, expect, it } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import { StellarKeypairReceiptSigner, verifyReceipt } from '@crawlpay/receipt-signer';
import type { AssetId, StellarAddress, X402PaymentPayload } from '@crawlpay/types';
import { MemoryNonceTracker, MemoryReceiptRepository } from '@crawlpay/persistence';
import type { SettleResult, SorobanSettlement } from '../services/soroban-settlement';
import { FacilitatorService, type VerifyInput } from '../services/facilitator-service';

const PUBLISHER = Keypair.random().publicKey() as StellarAddress;
const CRAWLER = Keypair.random().publicKey() as StellarAddress;
const USDC: AssetId = 'USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

class FakeSettlement implements SorobanSettlement {
  result: SettleResult;
  impl: (() => Promise<SettleResult>) | null = null;

  constructor(result: SettleResult) {
    this.result = result;
  }

  async settle(): Promise<SettleResult> {
    return this.impl ? this.impl() : this.result;
  }
}

function okSettlement(nonce: string): FakeSettlement {
  return new FakeSettlement({
    ok: true,
    from: CRAWLER,
    amount: '1000',
    nonce,
    onchainTxHash: 'fake-tx-hash',
  });
}

function makeInput(): VerifyInput {
  const payment: X402PaymentPayload = {
    x402Version: 1,
    scheme: 'exact',
    network: 'stellar-testnet',
    settlement: 'x402',
    payload: { authorizationEntry: 'AAAA', from: CRAWLER },
  };
  return {
    publisherId: 'pub_abc',
    payTo: PUBLISHER,
    resource: 'https://example.com/articles/foo',
    network: 'stellar-testnet',
    asset: USDC,
    maxAmountRequired: '1000',
    payment,
  };
}

function makeService(settlement: SorobanSettlement) {
  const signer = new StellarKeypairReceiptSigner(Keypair.random().secret());
  const nonces = new MemoryNonceTracker();
  const receipts = new MemoryReceiptRepository();
  const service = new FacilitatorService({
    settlement,
    signer,
    nonces,
    receipts,
    network: 'stellar-testnet',
  });
  return { service, signer, nonces, receipts };
}

describe('FacilitatorService.verify', () => {
  it('returns a signed verifiable receipt on settlement success', async () => {
    const { service, signer, receipts } = makeService(okSettlement('nonce-1'));
    const result = await service.verify(makeInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { receipt } = result.data;
    expect(receipt.resource).toBe('https://example.com/articles/foo');
    expect(receipt.from).toBe(CRAWLER);
    expect(receipt.to).toBe(PUBLISHER);
    expect(receipt.amount).toBe('1000');
    expect(receipt.network).toBe('stellar-testnet');
    expect(receipt.settlement).toBe('x402');
    expect(receipt.onchainTxHash).toBe('fake-tx-hash');
    expect(receipt.facilitatorPubkey).toBe(signer.publicKey);

    expect((await verifyReceipt(receipt)).valid).toBe(true);

    const stored = await receipts.getByNonce('nonce-1');
    expect(stored).toEqual({ ...receipt, publisherId: 'pub_abc' });
  });

  it('rejects a replayed nonce', async () => {
    const { service } = makeService(okSettlement('nonce-2'));

    const first = await service.verify(makeInput());
    expect(first.ok).toBe(true);

    const second = await service.verify(makeInput());
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe('replay');
  });

  it('propagates settlement error codes into the response', async () => {
    const settlement = new FakeSettlement({
      ok: false,
      error: { code: 'insufficient_balance', message: 'balance too low' },
    });
    const { service } = makeService(settlement);

    const result = await service.verify(makeInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('insufficient_balance');
  });

  it('wraps settlement throws as facilitator_error', async () => {
    const settlement = okSettlement('nonce-3');
    settlement.impl = async () => {
      throw new Error('soroban RPC 503');
    };
    const { service } = makeService(settlement);

    const result = await service.verify(makeInput());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('facilitator_error');
      expect(result.error.message).toContain('503');
    }
  });

  it('rejects a payment whose network does not match the offer', async () => {
    const { service } = makeService(okSettlement('nonce-4'));
    const input = makeInput();
    (input.payment as X402PaymentPayload).network = 'stellar-mainnet';

    const result = await service.verify(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('recipient_mismatch');
  });
});

describe('FacilitatorService.verifyReceiptSignature', () => {
  it('verifies a receipt the service itself issued', async () => {
    const { service, signer } = makeService(okSettlement('nonce-5'));
    const result = await service.verify(makeInput());
    if (!result.ok) throw new Error('verify failed');

    const v = await service.verifyReceiptSignature(result.data.receipt, signer.publicKey);
    expect(v.valid).toBe(true);
  });

  it('rejects a receipt with a tampered field', async () => {
    const { service } = makeService(okSettlement('nonce-6'));
    const result = await service.verify(makeInput());
    if (!result.ok) throw new Error('verify failed');

    const tampered = { ...result.data.receipt, amount: '999999' };
    const v = await service.verifyReceiptSignature(tampered);
    expect(v.valid).toBe(false);
  });
});
