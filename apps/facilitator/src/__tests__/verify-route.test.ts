import { describe, expect, it } from 'vitest';
import { Address, Asset, Keypair, authorizeEntry, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { StellarKeypairReceiptSigner } from '@octroi/receipt-signer';
import { MemoryNonceTracker, MemoryReceiptRepository } from '@octroi/persistence';
import type { AssetId, ContractAddress } from '@octroi/types';
import { NETWORK_PASSPHRASE } from '@octroi/types';
import { buildServer } from '../server';
import { FacilitatorService } from '../services/facilitator-service';
import { StellarSorobanSettlement, type SettlementGateway } from '../services/soroban-settlement';

const NETWORK = 'stellar-testnet';
const PASSPHRASE = NETWORK_PASSPHRASE[NETWORK];
const ISSUER = Keypair.random().publicKey();
const ASSET = `USDC:${ISSUER}` as AssetId;
const SAC = new Asset('USDC', ISSUER).contractId(PASSPHRASE) as ContractAddress;

class RecordingGateway implements SettlementGateway {
  submissions = 0;
  async currentLedger(): Promise<number> {
    return 100;
  }
  async submitTransfer(): Promise<string> {
    this.submissions += 1;
    return 'tx-route';
  }
}

async function signedTransfer(crawler: Keypair, to: string, amount: bigint): Promise<string> {
  const call = new xdr.InvokeContractArgs({
    contractAddress: new Address(SAC).toScAddress(),
    functionName: 'transfer',
    args: [
      new Address(crawler.publicKey()).toScVal(),
      new Address(to).toScVal(),
      nativeToScVal(amount, { type: 'i128' }),
    ],
  });
  const entry = new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: new Address(crawler.publicKey()).toScAddress(),
        nonce: xdr.Int64.fromString('42'),
        signatureExpirationLedger: 0,
        signature: xdr.ScVal.scvVoid(),
      }),
    ),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(call),
      subInvocations: [],
    }),
  });
  const signed = await authorizeEntry(entry, crawler, 200, PASSPHRASE);
  return signed.toXDR('base64');
}

function makeApp() {
  const gateway = new RecordingGateway();
  const service = new FacilitatorService({
    settlement: new StellarSorobanSettlement({
      rpcUrl: 'unused',
      network: NETWORK,
      sacAddress: SAC,
      gateway,
    }),
    signer: new StellarKeypairReceiptSigner(Keypair.random().secret()),
    nonces: new MemoryNonceTracker(),
    receipts: new MemoryReceiptRepository(),
    network: NETWORK,
    usdcAsset: ASSET,
  });
  return { app: buildServer({ service, network: NETWORK }), gateway };
}

async function verifyBody(opts: { amount: bigint; scheme?: string }) {
  const crawler = Keypair.random();
  const publisher = Keypair.random().publicKey();
  return {
    publisherId: 'pub_route',
    payTo: publisher,
    resource: 'https://example.com/articles/route',
    network: NETWORK,
    asset: ASSET,
    maxAmountRequired: '1000',
    payment: {
      x402Version: 1,
      scheme: opts.scheme ?? 'exact',
      network: NETWORK,
      settlement: 'x402',
      payload: {
        authorizationEntry: await signedTransfer(crawler, publisher, opts.amount),
        from: crawler.publicKey(),
      },
    },
  };
}

describe('POST /verify', () => {
  it('settles an exact payment and returns a receipt for the offered amount', async () => {
    const { app, gateway } = makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/verify',
      payload: await verifyBody({ amount: 1000n }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().receipt.amount).toBe('1000');
    expect(gateway.submissions).toBe(1);
  });

  it('rejects a payment whose scheme is not exact with 400', async () => {
    const { app, gateway } = makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/verify',
      payload: await verifyBody({ amount: 1000n, scheme: 'upto' }),
    });
    expect(res.statusCode).toBe(400);
    expect(gateway.submissions).toBe(0);
  });

  it('rejects a payment with a malformed x402 payload with 400', async () => {
    const { app, gateway } = makeApp();
    const body = await verifyBody({ amount: 1000n });
    const res = await app.inject({
      method: 'POST',
      url: '/verify',
      payload: { ...body, payment: { ...body.payment, payload: { from: 'not-an-address' } } },
    });
    expect(res.statusCode).toBe(400);
    expect(gateway.submissions).toBe(0);
  });

  it('passes a well-formed MPP payload to settlement, which reports it as not implemented', async () => {
    const { app, gateway } = makeApp();
    const body = await verifyBody({ amount: 1000n });
    const res = await app.inject({
      method: 'POST',
      url: '/verify',
      payload: {
        ...body,
        payment: {
          x402Version: 1,
          scheme: 'exact',
          network: NETWORK,
          settlement: 'mpp',
          payload: { sessionId: 'session-1', amount: '1000' },
        },
      },
    });
    expect(res.statusCode).toBe(402);
    expect(res.json().error.code).toBe('facilitator_error');
    expect(gateway.submissions).toBe(0);
  });

  it('refuses an underpayment with 402 amount_mismatch and submits nothing', async () => {
    const { app, gateway } = makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/verify',
      payload: await verifyBody({ amount: 1n }),
    });
    expect(res.statusCode).toBe(402);
    expect(res.json().error.code).toBe('amount_mismatch');
    expect(gateway.submissions).toBe(0);
  });
});
