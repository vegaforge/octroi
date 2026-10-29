import { describe, expect, it } from 'vitest';
import { Address, Asset, Keypair, authorizeEntry, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import type { AssetId, ContractAddress, StellarAddress, X402PaymentPayload } from '@octroi/types';
import { NETWORK_PASSPHRASE } from '@octroi/types';
import {
  StellarSorobanSettlement,
  validateTransferAuth,
  type SettleInput,
  type SettlementGateway,
} from '../services/soroban-settlement';

const NETWORK = 'stellar-testnet';
const PASSPHRASE = NETWORK_PASSPHRASE[NETWORK];

const ISSUER = Keypair.random().publicKey();
const ASSET = `USDC:${ISSUER}` as AssetId;
const SAC = new Asset('USDC', ISSUER).contractId(PASSPHRASE) as ContractAddress;

async function makeEntry(opts: {
  fromAddr: string;
  signWith: Keypair;
  to: string;
  amount: bigint;
  validUntil: number;
  sac?: string;
}): Promise<xdr.SorobanAuthorizationEntry> {
  const sac = opts.sac ?? SAC;
  const call = new xdr.InvokeContractArgs({
    contractAddress: new Address(sac).toScAddress(),
    functionName: 'transfer',
    args: [
      new Address(opts.fromAddr).toScVal(),
      new Address(opts.to).toScVal(),
      nativeToScVal(opts.amount, { type: 'i128' }),
    ],
  });
  const root = new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(call),
    subInvocations: [],
  });
  const credentials = xdr.SorobanCredentials.sorobanCredentialsAddress(
    new xdr.SorobanAddressCredentials({
      address: new Address(opts.fromAddr).toScAddress(),
      nonce: xdr.Int64.fromString('7654321'),
      signatureExpirationLedger: 0,
      signature: xdr.ScVal.scvVoid(),
    }),
  );
  const entry = new xdr.SorobanAuthorizationEntry({ credentials, rootInvocation: root });
  return authorizeEntry(entry, opts.signWith, opts.validUntil, PASSPHRASE);
}

function ctx(over: Partial<Parameters<typeof validateTransferAuth>[1]> = {}) {
  return {
    sac: SAC,
    payTo: 'PAY_TO' as StellarAddress,
    maxAmount: 1000n,
    declaredFrom: 'FROM' as StellarAddress,
    passphrase: PASSPHRASE,
    currentLedger: 100,
    ...over,
  };
}

describe('validateTransferAuth', () => {
  it('accepts a well-formed transfer authorization', async () => {
    const crawler = Keypair.random();
    const publisher = Keypair.random().publicKey();
    const entry = await makeEntry({
      fromAddr: crawler.publicKey(),
      signWith: crawler,
      to: publisher,
      amount: 1000n,
      validUntil: 200,
    });
    const result = validateTransferAuth(
      entry,
      ctx({
        payTo: publisher as StellarAddress,
        declaredFrom: crawler.publicKey() as StellarAddress,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.from).toBe(crawler.publicKey());
    expect(result.to).toBe(publisher);
    expect(result.amount).toBe(1000n);
    expect(result.nonce).toBe('7654321');
  });

  it('rejects when the recipient is not payTo', async () => {
    const crawler = Keypair.random();
    const entry = await makeEntry({
      fromAddr: crawler.publicKey(),
      signWith: crawler,
      to: Keypair.random().publicKey(),
      amount: 1000n,
      validUntil: 200,
    });
    const result = validateTransferAuth(
      entry,
      ctx({
        payTo: Keypair.random().publicKey() as StellarAddress,
        declaredFrom: crawler.publicKey() as StellarAddress,
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('recipient_mismatch');
  });

  it('rejects when the amount exceeds the ceiling', async () => {
    const crawler = Keypair.random();
    const publisher = Keypair.random().publicKey();
    const entry = await makeEntry({
      fromAddr: crawler.publicKey(),
      signWith: crawler,
      to: publisher,
      amount: 5000n,
      validUntil: 200,
    });
    const result = validateTransferAuth(
      entry,
      ctx({
        payTo: publisher as StellarAddress,
        declaredFrom: crawler.publicKey() as StellarAddress,
        maxAmount: 1000n,
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('amount_exceeded');
  });

  it('rejects an authorization for less than the offered amount', async () => {
    const crawler = Keypair.random();
    const publisher = Keypair.random().publicKey();
    const entry = await makeEntry({
      fromAddr: crawler.publicKey(),
      signWith: crawler,
      to: publisher,
      amount: 1n,
      validUntil: 200,
    });
    const result = validateTransferAuth(
      entry,
      ctx({
        payTo: publisher as StellarAddress,
        declaredFrom: crawler.publicKey() as StellarAddress,
        maxAmount: 1000n,
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('amount_mismatch');
  });

  it('rejects an expired signature window', async () => {
    const crawler = Keypair.random();
    const publisher = Keypair.random().publicKey();
    const entry = await makeEntry({
      fromAddr: crawler.publicKey(),
      signWith: crawler,
      to: publisher,
      amount: 1000n,
      validUntil: 100,
    });
    const result = validateTransferAuth(
      entry,
      ctx({
        payTo: publisher as StellarAddress,
        declaredFrom: crawler.publicKey() as StellarAddress,
        currentLedger: 100,
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('expired');
  });

  it('rejects an authorization for a different contract', async () => {
    const crawler = Keypair.random();
    const publisher = Keypair.random().publicKey();
    const otherSac = new Asset('USDC', Keypair.random().publicKey()).contractId(PASSPHRASE);
    const entry = await makeEntry({
      fromAddr: crawler.publicKey(),
      signWith: crawler,
      to: publisher,
      amount: 1000n,
      validUntil: 200,
      sac: otherSac,
    });
    const result = validateTransferAuth(
      entry,
      ctx({
        payTo: publisher as StellarAddress,
        declaredFrom: crawler.publicKey() as StellarAddress,
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('invalid_payload');
  });

  it('rejects when the signature is not from the authorizer', async () => {
    const crawler = Keypair.random();
    const imposter = Keypair.random();
    const publisher = Keypair.random().publicKey();
    // credentials/from say crawler, but the entry is signed by the imposter
    const entry = await makeEntry({
      fromAddr: crawler.publicKey(),
      signWith: imposter,
      to: publisher,
      amount: 1000n,
      validUntil: 200,
    });
    const result = validateTransferAuth(
      entry,
      ctx({
        payTo: publisher as StellarAddress,
        declaredFrom: crawler.publicKey() as StellarAddress,
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('invalid_signature');
  });

  it('rejects when the declared from does not match the authorization', async () => {
    const crawler = Keypair.random();
    const publisher = Keypair.random().publicKey();
    const entry = await makeEntry({
      fromAddr: crawler.publicKey(),
      signWith: crawler,
      to: publisher,
      amount: 1000n,
      validUntil: 200,
    });
    const result = validateTransferAuth(
      entry,
      ctx({
        payTo: publisher as StellarAddress,
        declaredFrom: Keypair.random().publicKey() as StellarAddress,
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('invalid_signature');
  });
});

class FakeGateway implements SettlementGateway {
  submitted: xdr.SorobanAuthorizationEntry | null = null;
  constructor(
    readonly ledger = 100,
    readonly txHash = 'fake-tx-hash',
  ) {}
  async currentLedger(): Promise<number> {
    return this.ledger;
  }
  async submitTransfer(entry: xdr.SorobanAuthorizationEntry): Promise<string> {
    this.submitted = entry;
    return this.txHash;
  }
}

function makeInput(
  authEntry: xdr.SorobanAuthorizationEntry,
  from: string,
  payTo: string,
): SettleInput {
  const payment: X402PaymentPayload = {
    x402Version: 1,
    scheme: 'exact',
    network: NETWORK,
    settlement: 'x402',
    payload: { authorizationEntry: authEntry.toXDR('base64'), from: from as StellarAddress },
  };
  return {
    payment,
    payTo: payTo as StellarAddress,
    asset: ASSET,
    network: NETWORK,
    maxAmountRequired: '1000',
  };
}

describe('StellarSorobanSettlement.settle', () => {
  it('settles a valid payment and returns the tx hash', async () => {
    const crawler = Keypair.random();
    const publisher = Keypair.random().publicKey();
    const entry = await makeEntry({
      fromAddr: crawler.publicKey(),
      signWith: crawler,
      to: publisher,
      amount: 1000n,
      validUntil: 200,
    });
    const gateway = new FakeGateway(100, 'tx-123');
    const settlement = new StellarSorobanSettlement({
      rpcUrl: 'unused',
      network: NETWORK,
      sacAddress: SAC,
      gateway,
    });

    const result = await settlement.settle(makeInput(entry, crawler.publicKey(), publisher));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.from).toBe(crawler.publicKey());
    expect(result.amount).toBe('1000');
    expect(result.nonce).toBe('7654321');
    expect(result.onchainTxHash).toBe('tx-123');
    expect(gateway.submitted).not.toBeNull();
  });

  it('does not submit when validation fails', async () => {
    const crawler = Keypair.random();
    const publisher = Keypair.random().publicKey();
    const entry = await makeEntry({
      fromAddr: crawler.publicKey(),
      signWith: crawler,
      to: publisher,
      amount: 9000n,
      validUntil: 200,
    });
    const gateway = new FakeGateway(100);
    const settlement = new StellarSorobanSettlement({
      rpcUrl: 'unused',
      network: NETWORK,
      sacAddress: SAC,
      gateway,
    });

    const result = await settlement.settle(makeInput(entry, crawler.publicKey(), publisher));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('amount_exceeded');
    expect(gateway.submitted).toBeNull();
  });

  it('rejects an MPP payload (not implemented yet)', async () => {
    const settlement = new StellarSorobanSettlement({
      rpcUrl: 'unused',
      network: NETWORK,
      sacAddress: SAC,
      gateway: new FakeGateway(),
    });
    const result = await settlement.settle({
      payment: {
        x402Version: 1,
        scheme: 'exact',
        network: NETWORK,
        settlement: 'mpp',
        payload: { sessionId: 's1', amount: '1000' },
      },
      payTo: Keypair.random().publicKey() as StellarAddress,
      asset: ASSET,
      network: NETWORK,
      maxAmountRequired: '1000',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('facilitator_error');
  });
});
