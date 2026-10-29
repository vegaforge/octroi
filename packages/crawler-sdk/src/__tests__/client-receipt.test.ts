import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import { StellarKeypairReceiptSigner, signReceipt } from '@octroi/receipt-signer';
import {
  atomicUsdc,
  stellarAddress,
  type AssetId,
  type PaymentRequiredResponse,
  type PaymentRequirement,
  type X402PaymentPayload,
} from '@octroi/types';
import { OctroiClient } from '../client';
import type { CrawlerBalance, PaymentSigner } from '../payment-signer';
import { ReceiptVerificationError } from '../types';

const CRAWLER = stellarAddress(Keypair.random().publicKey());
const PUBLISHER = stellarAddress(Keypair.random().publicKey());
const ASSET: AssetId = `USDC:${Keypair.random().publicKey()}`;

class StubSigner implements PaymentSigner {
  readonly address = CRAWLER;
  createPayment(requirement: PaymentRequirement): Promise<X402PaymentPayload> {
    return Promise.resolve({
      x402Version: 1,
      scheme: 'exact',
      network: requirement.network,
      settlement: 'x402',
      payload: { authorizationEntry: 'AAAA', from: CRAWLER },
    });
  }
  getBalance(): Promise<CrawlerBalance> {
    return Promise.resolve({ available: atomicUsdc(1_000_000n) });
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

/** A publisher that answers 402 with an offer, then 200 with `receiptHeader` once paid. */
async function startPublisher(receiptHeader: string): Promise<string> {
  const listening = createServer((req, res) => {
    const resource = `http://${req.headers.host ?? ''}${req.url ?? '/'}`;
    if (!req.headers['x-payment']) {
      const offer: PaymentRequiredResponse = {
        x402Version: 1,
        accepts: [
          {
            scheme: 'exact',
            network: 'stellar-testnet',
            maxAmountRequired: '1000',
            resource,
            payTo: PUBLISHER,
            asset: ASSET,
            maxTimeoutSeconds: 60,
            extra: { settlement: 'x402' },
          },
        ],
      };
      res.writeHead(402, { 'content-type': 'application/json' });
      res.end(JSON.stringify(offer));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/plain', 'x-payment-response': receiptHeader });
    res.end('the article');
  });
  server = listening;
  await new Promise<void>((resolve) => listening.listen(0, '127.0.0.1', resolve));
  const { port } = listening.address() as AddressInfo;
  return `http://127.0.0.1:${port}/article`;
}

function makeClient(): OctroiClient {
  return new OctroiClient({
    secret: Keypair.random().secret(),
    network: 'stellar-testnet',
    maxPerRequest: atomicUsdc(10_000n),
    paymentSigner: new StubSigner(),
  });
}

function base64Json(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf-8').toString('base64');
}

describe('OctroiClient receipt handling', () => {
  it('accepts and stores a well-formed signed receipt', async () => {
    const signer = new StellarKeypairReceiptSigner(Keypair.random().secret());
    const receipt = await signReceipt(
      {
        version: '1',
        resource: 'http://127.0.0.1/article',
        amount: '1000',
        asset: ASSET,
        network: 'stellar-testnet',
        from: CRAWLER,
        to: PUBLISHER,
        nonce: '7',
        timestamp: '2026-10-29T12:00:00.000Z',
        settlement: 'x402',
        onchainTxHash: 'tx-test',
        mppSessionRef: null,
      },
      signer,
    );
    const url = await startPublisher(base64Json(receipt));

    const client = makeClient();
    const result = await client.fetch<string>(url);
    expect(result.data).toBe('the article');
    expect(await client.listReceipts()).toEqual([receipt]);
  });

  // Before this fix a header that did not decode was reported through onError and then
  // dropped, so the paid content was returned with no receipt at all.
  it('refuses a receipt header that is not base64 JSON', async () => {
    const url = await startPublisher('%%% not a receipt %%%');
    const client = makeClient();
    await expect(client.fetch(url)).rejects.toBeInstanceOf(ReceiptVerificationError);
    expect(await client.listReceipts()).toEqual([]);
  });

  it('refuses a receipt header whose JSON is not a receipt', async () => {
    const url = await startPublisher(base64Json({ amount: '1000' }));
    const client = makeClient();
    await expect(client.fetch(url)).rejects.toThrow(/malformed receipt/);
    expect(await client.listReceipts()).toEqual([]);
  });
});
