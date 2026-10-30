import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import express, { type ErrorRequestHandler } from 'express';
import { Keypair } from '@stellar/stellar-base';
import { atomicUsdc, stellarAddress, type AssetId, type Ed25519Signature } from '@octroi/types';
import { octroi } from '../express';
import type {
  FacilitatorClient,
  FacilitatorVerifyRequest,
  FacilitatorVerifyResult,
} from '../facilitator';
import type { OctroiMiddlewareConfig } from '../types';

const PUBLISHER = stellarAddress(Keypair.random().publicKey());
const CRAWLER = stellarAddress(Keypair.random().publicKey());
const ASSET: AssetId = `USDC:${Keypair.random().publicKey()}`;

class AcceptingFacilitator implements FacilitatorClient {
  verify(request: FacilitatorVerifyRequest): Promise<FacilitatorVerifyResult> {
    return Promise.resolve({
      ok: true,
      receipt: {
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
      },
    });
  }
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

/** Mounts the middleware with `hooks` and an error handler that reports the error message. */
async function start(hooks: Pick<OctroiMiddlewareConfig, 'onSkip' | 'onPayment'>): Promise<string> {
  const app = express();
  app.use(
    octroi({
      publisherId: 'pub_test',
      publisherWallet: PUBLISHER,
      asset: ASSET,
      network: 'stellar-testnet',
      facilitatorUrl: 'http://facilitator.invalid',
      defaultPrice: atomicUsdc(1000n),
      facilitator: new AcceptingFacilitator(),
      ...hooks,
    }),
  );
  app.get('/article', (_req, res) => {
    res.status(200).send('the article');
  });
  const reportError: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  };
  app.use(reportError);

  const listening = app.listen(0, '127.0.0.1');
  server = listening;
  await new Promise<void>((resolve) => listening.once('listening', resolve));
  const { port } = listening.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
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

describe('octroi express middleware, rejected hooks', () => {
  // Before the fix the middleware was an async function handed to Express 4, which ignores
  // the returned promise: the rejection went unhandled and the request never completed.
  // The timeout turns that hang into a test failure instead of a stuck run.
  it('passes a rejected onSkip hook to the Express error handler', async () => {
    const baseUrl = await start({
      onSkip: () => Promise.reject(new Error('onSkip hook failed')),
    });
    const res = await fetch(`${baseUrl}/article`, {
      headers: { 'user-agent': 'Mozilla/5.0', accept: 'text/html', 'accept-language': 'en' },
      signal: AbortSignal.timeout(2000),
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'onSkip hook failed' });
  });

  it('passes a rejected onPayment hook to the Express error handler', async () => {
    const baseUrl = await start({
      onPayment: () => Promise.reject(new Error('onPayment hook failed')),
    });
    const res = await fetch(`${baseUrl}/article`, {
      headers: { 'user-agent': 'GPTBot/1.0', 'x-payment': PAYMENT_HEADER },
      signal: AbortSignal.timeout(2000),
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'onPayment hook failed' });
  });
});
