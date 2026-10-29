import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import { Keypair } from '@stellar/stellar-base';
import {
  atomicUsdc,
  stellarAddress,
  type AssetId,
  type Ed25519Signature,
  type OctroiReceipt,
} from '@octroi/types';
import { octroi } from '../express';
import type {
  FacilitatorClient,
  FacilitatorVerifyRequest,
  FacilitatorVerifyResult,
} from '../facilitator';
import type { ErrorEvent, PaymentEvent } from '../types';

const PUBLISHER = stellarAddress(Keypair.random().publicKey());
const CRAWLER = stellarAddress(Keypair.random().publicKey());
const ASSET: AssetId = `USDC:${Keypair.random().publicKey()}`;
const PRICE = atomicUsdc(1000n);

/** Builds the receipt an honest facilitator would return for `request`, then applies overrides. */
function receiptFor(
  request: FacilitatorVerifyRequest,
  overrides: Partial<OctroiReceipt>,
): OctroiReceipt {
  return {
    version: '1',
    resource: request.resource,
    amount: request.maxAmountRequired,
    asset: request.asset,
    network: request.network,
    from: CRAWLER,
    to: request.payTo,
    nonce: '1',
    timestamp: new Date().toISOString(),
    settlement: 'x402',
    onchainTxHash: 'tx-test',
    mppSessionRef: null,
    facilitatorPubkey: stellarAddress(Keypair.random().publicKey()),
    signature: 'c2lnbmF0dXJl' as Ed25519Signature,
    ...overrides,
  };
}

class StubFacilitator implements FacilitatorClient {
  constructor(private readonly overrides: Partial<OctroiReceipt>) {}
  async verify(request: FacilitatorVerifyRequest): Promise<FacilitatorVerifyResult> {
    return { ok: true, receipt: receiptFor(request, this.overrides) };
  }
}

interface Harness {
  baseUrl: string;
  handlerHits: () => number;
  payments: PaymentEvent[];
  errors: ErrorEvent[];
}

let server: Server | undefined;

afterEach(async () => {
  const running = server;
  server = undefined;
  if (!running) return;
  await new Promise<void>((resolve, reject) => {
    running.close((err) => (err ? reject(err) : resolve()));
  });
});

async function start(overrides: Partial<OctroiReceipt>): Promise<Harness> {
  const payments: PaymentEvent[] = [];
  const errors: ErrorEvent[] = [];
  let hits = 0;

  const app = express();
  app.use(
    octroi({
      publisherId: 'pub_test',
      publisherWallet: PUBLISHER,
      asset: ASSET,
      network: 'stellar-testnet',
      facilitatorUrl: 'http://facilitator.invalid',
      defaultPrice: PRICE,
      facilitator: new StubFacilitator(overrides),
      onPayment: (event) => {
        payments.push(event);
      },
      onError: (event) => {
        errors.push(event);
      },
    }),
  );
  app.get('/article', (_req, res) => {
    hits += 1;
    res.status(200).send('the article');
  });

  const listening = app.listen(0, '127.0.0.1');
  server = listening;
  await new Promise<void>((resolve) => listening.once('listening', resolve));
  const { port } = listening.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${port}`, handlerHits: () => hits, payments, errors };
}

const PAYMENT_HEADER = Buffer.from(
  JSON.stringify({
    x402Version: 1,
    scheme: 'exact',
    network: 'stellar-testnet',
    settlement: 'x402',
    payload: { authorizationEntry: 'AAAA', from: CRAWLER },
  }),
).toString('base64');

function paidRequest(baseUrl: string): Promise<Response> {
  return fetch(`${baseUrl}/article`, {
    headers: { 'user-agent': 'GPTBot/1.0', 'x-payment': PAYMENT_HEADER },
  });
}

describe('octroi express middleware, receipt check', () => {
  it('serves the route and reports the receipt amount when the receipt matches the offer', async () => {
    const h = await start({});
    const res = await paidRequest(h.baseUrl);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('the article');
    expect(res.headers.get('x-payment-response')).not.toBeNull();
    expect(h.handlerHits()).toBe(1);
    expect(h.payments).toHaveLength(1);
    expect(h.payments[0]?.amount).toBe(1000n);
    expect(h.errors).toHaveLength(0);
  });

  const mismatches: Array<[string, Partial<OctroiReceipt>]> = [
    ['amount', { amount: '1' }],
    ['to', { to: stellarAddress(Keypair.random().publicKey()) }],
    ['resource', { resource: 'https://elsewhere.example/other' }],
    ['asset', { asset: `USDC:${Keypair.random().publicKey()}` }],
    ['network', { network: 'stellar-mainnet' }],
  ];

  it.each(mismatches)(
    'refuses with 502 when the receipt %s differs from the offer',
    async (field, overrides) => {
      const h = await start(overrides);
      const res = await paidRequest(h.baseUrl);

      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ x402Version: 1, error: 'facilitator_error' });
      expect(res.headers.get('x-payment-response')).toBeNull();
      expect(h.handlerHits()).toBe(0);
      expect(h.payments).toHaveLength(0);
      expect(h.errors).toHaveLength(1);
      expect(h.errors[0]?.phase).toBe('verify');
      expect(h.errors[0]?.error.message).toContain(`receipt ${field}`);
    },
  );
});
