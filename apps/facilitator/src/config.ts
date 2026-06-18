import type { AssetId, ContractAddress, Network } from '@octroi/types';
import { NETWORKS } from '@octroi/types';

export interface FacilitatorConfig {
  port: number;
  logLevel: string;
  network: Network;
  /** Soroban RPC endpoint used to submit settlement and read ledger state. */
  sorobanRpcUrl: string;
  /** USDC asset (`USDC:ISSUER`) the facilitator settles. */
  usdcAsset: AssetId;
  /** USDC Stellar Asset Contract address (the SAC the `transfer` invokes). */
  usdcSacAddress: ContractAddress;
  /** Stellar secret seed (S...) used only to sign receipts. Holds no funds. */
  receiptSigningSeed: string;
  /** Stellar secret seed of the account that sponsors transaction fees. */
  feeSponsorSeed?: string;
  /** When set, the facilitator uses PostgresReceiptRepository instead of memory. */
  databaseUrl?: string;
  /** When set, the facilitator uses RedisNonceTracker instead of memory. */
  redisUrl?: string;
}

const SECRET_SEED_RE = /^S[A-Z2-7]{55}$/;
const ASSET_RE = /^[A-Za-z0-9]{1,12}:G[A-Z2-7]{55}$/;
const CONTRACT_RE = /^C[A-Z2-7]{55}$/;

/** Parse and validate env vars. Throws on bad values so we fail fast at startup. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): FacilitatorConfig {
  const port = Number(env.FACILITATOR_PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `FACILITATOR_PORT must be an integer in [1, 65535]; got ${env.FACILITATOR_PORT}`,
    );
  }

  const network = (env.OCTROI_NETWORK ?? 'stellar-testnet') as Network;
  if (!NETWORKS.includes(network)) {
    throw new Error(`OCTROI_NETWORK "${network}" not supported. Supported: ${NETWORKS.join(', ')}`);
  }

  const sorobanRpcUrl = env.SOROBAN_RPC_URL;
  if (!sorobanRpcUrl) {
    throw new Error('SOROBAN_RPC_URL is required');
  }

  const usdcAsset = env.OCTROI_USDC_ASSET;
  if (!usdcAsset || !ASSET_RE.test(usdcAsset)) {
    throw new Error('OCTROI_USDC_ASSET must be in the form CODE:ISSUER_G_ADDRESS');
  }

  const usdcSacAddress = env.OCTROI_USDC_SAC;
  if (!usdcSacAddress || !CONTRACT_RE.test(usdcSacAddress)) {
    throw new Error('OCTROI_USDC_SAC must be a Soroban contract address (C...)');
  }

  const receiptSigningSeed = env.OCTROI_RECEIPT_SEED;
  if (!receiptSigningSeed || !SECRET_SEED_RE.test(receiptSigningSeed)) {
    throw new Error('OCTROI_RECEIPT_SEED must be a Stellar secret seed (S...)');
  }

  const feeSponsorSeed = env.OCTROI_FEE_SPONSOR_SEED || undefined;
  if (feeSponsorSeed && !SECRET_SEED_RE.test(feeSponsorSeed)) {
    throw new Error('OCTROI_FEE_SPONSOR_SEED must be a Stellar secret seed (S...)');
  }

  return {
    port,
    logLevel: env.LOG_LEVEL ?? 'info',
    network,
    sorobanRpcUrl,
    usdcAsset: usdcAsset as AssetId,
    usdcSacAddress: usdcSacAddress as ContractAddress,
    receiptSigningSeed,
    feeSponsorSeed,
    databaseUrl: env.DATABASE_URL || undefined,
    redisUrl: env.REDIS_URL || undefined,
  };
}
