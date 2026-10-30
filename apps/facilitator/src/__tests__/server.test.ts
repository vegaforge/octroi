import { describe, expect, it } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import { StellarKeypairReceiptSigner } from '@octroi/receipt-signer';
import { MemoryNonceTracker, MemoryReceiptRepository } from '@octroi/persistence';
import type { AssetId } from '@octroi/types';
import { buildServer } from '../server';
import { FacilitatorService } from '../services/facilitator-service';
import type { SettleResult, SorobanSettlement } from '../services/soroban-settlement';

class UnusedSettlement implements SorobanSettlement {
  settle(): Promise<SettleResult> {
    return Promise.reject(new Error('settle is not part of these routes'));
  }
}

function makeApp() {
  const signer = new StellarKeypairReceiptSigner(Keypair.random().secret());
  const service = new FacilitatorService({
    settlement: new UnusedSettlement(),
    signer,
    nonces: new MemoryNonceTracker(),
    receipts: new MemoryReceiptRepository(),
    network: 'stellar-testnet',
    // These routes never settle, so any well-formed asset id works here.
    usdcAsset: `USDC:${Keypair.random().publicKey()}` as AssetId,
  });
  return { app: buildServer({ service, network: 'stellar-testnet' }), signer };
}

describe('facilitator read-only routes', () => {
  it('GET /health reports the service, network and signing key', async () => {
    const { app, signer } = makeApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      service: 'octroi-facilitator',
      version: '0.0.1',
      network: 'stellar-testnet',
      facilitatorPublicKey: signer.publicKey,
    });
  });

  it('GET /pubkey returns the receipt-signing public key', async () => {
    const { app, signer } = makeApp();
    const res = await app.inject({ method: 'GET', url: '/pubkey' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ publicKey: signer.publicKey, version: '1' });
  });
});
