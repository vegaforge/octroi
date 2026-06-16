import { describe, expect, it } from 'vitest';
import { Keypair, Address, hash, scValToNative, xdr } from '@stellar/stellar-sdk';
import type { AssetId, PaymentRequirement, StellarAddress } from '@crawlpay/types';
import { NETWORK_PASSPHRASE } from '@crawlpay/types';
import { StellarPaymentSigner, deriveSacContractId } from '../payment-signer';

const NETWORK = 'stellar-testnet';
const PASSPHRASE = NETWORK_PASSPHRASE[NETWORK];

function makeRequirement(overrides: Partial<PaymentRequirement> = {}): {
  requirement: PaymentRequirement;
  issuer: string;
  publisher: StellarAddress;
} {
  const issuer = Keypair.random().publicKey();
  const publisher = Keypair.random().publicKey() as StellarAddress;
  const requirement: PaymentRequirement = {
    scheme: 'exact',
    network: NETWORK,
    maxAmountRequired: '1000',
    resource: 'https://example.com/articles/foo',
    payTo: publisher,
    asset: `USDC:${issuer}` as AssetId,
    maxTimeoutSeconds: 60,
    extra: { settlement: 'x402' },
    ...overrides,
  };
  return { requirement, issuer, publisher };
}

function signerFor(crawler: Keypair, ledger = 5000) {
  return new StellarPaymentSigner(NETWORK, crawler.secret(), {
    rpcUrl: 'unused-in-tests',
    ledgerSource: async () => ledger,
  });
}

describe('deriveSacContractId', () => {
  it('derives a deterministic C-address from CODE:ISSUER', () => {
    const issuer = Keypair.random().publicKey();
    const a = deriveSacContractId(`USDC:${issuer}`, PASSPHRASE);
    const b = deriveSacContractId(`USDC:${issuer}`, PASSPHRASE);
    expect(a).toBe(b);
    expect(a.startsWith('C')).toBe(true);
    expect(a).toHaveLength(56);
  });

  it('throws on a malformed asset', () => {
    expect(() => deriveSacContractId('USDC', PASSPHRASE)).toThrow();
  });
});

describe('StellarPaymentSigner.createPayment', () => {
  it('builds an x402 payload from the crawler address', async () => {
    const crawler = Keypair.random();
    const { requirement } = makeRequirement();
    const payment = await signerFor(crawler).createPayment(requirement);

    expect(payment.x402Version).toBe(1);
    expect(payment.scheme).toBe('exact');
    expect(payment.network).toBe(NETWORK);
    expect(payment.settlement).toBe('x402');
    expect(payment.payload.from).toBe(crawler.publicKey());
    expect(payment.payload.authorizationEntry).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('authorizes the exact USDC SAC transfer in the offer', async () => {
    const crawler = Keypair.random();
    const { requirement, publisher } = makeRequirement({ maxAmountRequired: '2500' });
    const payment = await signerFor(crawler, 5000).createPayment(requirement);

    const entry = xdr.SorobanAuthorizationEntry.fromXDR(
      payment.payload.authorizationEntry,
      'base64',
    );
    const addr = entry.credentials().address();

    // window = ceil(60 / 5) = 12 ledgers
    expect(addr.signatureExpirationLedger()).toBe(5012);
    expect(Address.fromScAddress(addr.address()).toString()).toBe(crawler.publicKey());

    const fn = entry.rootInvocation().function().contractFn();
    expect(Address.fromScAddress(fn.contractAddress()).toString()).toBe(
      deriveSacContractId(requirement.asset, PASSPHRASE),
    );
    expect(fn.functionName().toString()).toBe('transfer');

    const args = fn.args();
    expect(Address.fromScVal(args[0]!).toString()).toBe(crawler.publicKey());
    expect(Address.fromScVal(args[1]!).toString()).toBe(publisher);
    expect(scValToNative(args[2]!)).toBe(2500n);
  });

  it('produces a signature that verifies against the crawler key', async () => {
    const crawler = Keypair.random();
    const { requirement } = makeRequirement();
    const payment = await signerFor(crawler).createPayment(requirement);

    const entry = xdr.SorobanAuthorizationEntry.fromXDR(
      payment.payload.authorizationEntry,
      'base64',
    );
    const addr = entry.credentials().address();

    const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
      new xdr.HashIdPreimageSorobanAuthorization({
        networkId: hash(Buffer.from(PASSPHRASE)),
        nonce: addr.nonce(),
        invocation: entry.rootInvocation(),
        signatureExpirationLedger: addr.signatureExpirationLedger(),
      }),
    );
    const payload = hash(preimage.toXDR());

    const sigStruct = addr.signature().vec()![0]!.map()!;
    const sigBytes = sigStruct
      .find((e) => e.key().sym().toString() === 'signature')!
      .val()
      .bytes();
    expect(crawler.verify(payload, Buffer.from(sigBytes))).toBe(true);
  });

  it('uses a fresh nonce per payment', async () => {
    const crawler = Keypair.random();
    const { requirement } = makeRequirement();
    const signer = signerFor(crawler);
    const a = await signer.createPayment(requirement);
    const b = await signer.createPayment(requirement);
    expect(a.payload.authorizationEntry).not.toBe(b.payload.authorizationEntry);
  });
});
