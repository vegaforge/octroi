import { describe, expect, it } from 'vitest';
import { Asset, Keypair } from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASE } from '@octroi/types';
import { loadConfig } from '../config';

const ISSUER = Keypair.random().publicKey();

function baseEnv(over: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    OCTROI_NETWORK: 'stellar-testnet',
    SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
    OCTROI_USDC_ASSET: `USDC:${ISSUER}`,
    OCTROI_USDC_SAC: new Asset('USDC', ISSUER).contractId(NETWORK_PASSPHRASE['stellar-testnet']),
    OCTROI_RECEIPT_SEED: Keypair.random().secret(),
    ...over,
  };
}

describe('loadConfig', () => {
  it('accepts a SAC address derived from the configured asset and network', () => {
    const config = loadConfig(baseEnv());
    expect(config.usdcAsset).toBe(`USDC:${ISSUER}`);
  });

  it('refuses to start when OCTROI_USDC_SAC is the SAC of a different issuer', () => {
    const otherSac = new Asset('USDC', Keypair.random().publicKey()).contractId(
      NETWORK_PASSPHRASE['stellar-testnet'],
    );
    expect(() => loadConfig(baseEnv({ OCTROI_USDC_SAC: otherSac }))).toThrow(
      /OCTROI_USDC_SAC .* is not the Stellar Asset Contract of OCTROI_USDC_ASSET/,
    );
  });

  it('refuses to start when OCTROI_USDC_SAC was derived for another network', () => {
    const mainnetSac = new Asset('USDC', ISSUER).contractId(NETWORK_PASSPHRASE['stellar-mainnet']);
    expect(() => loadConfig(baseEnv({ OCTROI_USDC_SAC: mainnetSac }))).toThrow(
      /is not the Stellar Asset Contract of OCTROI_USDC_ASSET/,
    );
  });
});
