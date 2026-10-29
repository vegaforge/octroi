import { afterEach, describe, expect, it, vi } from 'vitest';
import { Keypair, SorobanDataBuilder, nativeToScVal, rpc, xdr } from '@stellar/stellar-sdk';
import type { AssetId } from '@octroi/types';
import { StellarPaymentSigner } from '../payment-signer';

const ASSET = `USDC:${Keypair.random().publicKey()}` as AssetId;

/** A successful `simulateTransaction` response whose invocation returned `retval`. */
function simulated(retval: xdr.ScVal): rpc.Api.SimulateTransactionSuccessResponse {
  return {
    id: '1',
    latestLedger: 100,
    events: [],
    _parsed: true,
    transactionData: new SorobanDataBuilder(),
    minResourceFee: '0',
    result: { auth: [], retval },
  };
}

function signer(): StellarPaymentSigner {
  return new StellarPaymentSigner('stellar-testnet', Keypair.random().secret(), {
    rpcUrl: 'http://soroban.invalid',
    usdcAsset: ASSET,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('StellarPaymentSigner.getBalance against Soroban RPC', () => {
  it('returns the i128 the SAC balance call simulated', async () => {
    vi.spyOn(rpc.Server.prototype, 'simulateTransaction').mockResolvedValue(
      simulated(nativeToScVal(12_345n, { type: 'i128' })),
    );
    await expect(signer().getBalance()).resolves.toEqual({ available: 12_345n });
  });

  // Before the fix `BigInt(value ?? 0)` turned a void result into a balance of 0, which
  // looks like an empty wallet instead of a broken contract call.
  it('refuses a balance result that is not an integer', async () => {
    vi.spyOn(rpc.Server.prototype, 'simulateTransaction').mockResolvedValue(
      simulated(xdr.ScVal.scvVoid()),
    );
    await expect(signer().getBalance()).rejects.toThrow(/expected an i128/);
  });
});
