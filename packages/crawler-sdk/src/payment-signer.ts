import { randomBytes } from 'node:crypto';
import {
  Account,
  Address,
  Asset,
  BASE_FEE,
  Contract,
  Keypair,
  TransactionBuilder,
  authorizeEntry,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import type {
  AssetId,
  AtomicUsdc,
  Network,
  PaymentRequirement,
  StellarAddress,
  X402PaymentPayload,
} from '@octroi/types';
import { NETWORK_PASSPHRASE, atomicUsdc } from '@octroi/types';

export interface CrawlerBalance {
  /** USDC available to spend, atomic. */
  available: AtomicUsdc;
}

/**
 * Signs payments for the crawler. Default signs a Soroban auth entry for the
 * offered USDC SAC transfer. Pluggable for a smart wallet or remote signer.
 */
export interface PaymentSigner {
  /** The crawler's Stellar G-address (payment account and identity). */
  readonly address: StellarAddress;
  /** Build and sign an `X-PAYMENT` payload for the offer (a Soroban auth entry). */
  createPayment(requirement: PaymentRequirement): Promise<X402PaymentPayload>;
  /** Read the crawler's spendable USDC balance. */
  getBalance(): Promise<CrawlerBalance>;
}

export interface StellarPaymentSignerOptions {
  /** Soroban RPC endpoint, used to read the current ledger and the USDC balance. */
  rpcUrl: string;
  /** USDC asset (`CODE:ISSUER`). Required for getBalance, which has no offer to read it from. */
  usdcAsset?: AssetId;
  /** Override the current-ledger lookup. Used by tests; defaults to the RPC server. */
  ledgerSource?: () => Promise<number>;
  /** Override the SAC balance read. Used by tests; defaults to a Soroban simulation. */
  balanceReader?: (sacContractId: string, owner: string) => Promise<bigint>;
}

/** Stellar ledgers close roughly every 5s; used to turn the offer timeout into a ledger count. */
const SECONDS_PER_LEDGER = 5;

/**
 * Default Stellar signer. It authorizes the USDC SAC `transfer` from the
 * crawler to the publisher by signing a Soroban authorization entry with the
 * crawler's key. The entry carries a short expiration window, so signing needs
 * the current ledger from Soroban RPC.
 */
export class StellarPaymentSigner implements PaymentSigner {
  readonly address: StellarAddress;
  readonly #network: Network;
  readonly #passphrase: string;
  readonly #keypair: Keypair;
  readonly #rpcUrl: string;
  readonly #usdcAsset?: AssetId;
  readonly #ledgerSource?: () => Promise<number>;
  readonly #balanceReader?: (sacContractId: string, owner: string) => Promise<bigint>;

  constructor(network: Network, secretSeed: string, opts: StellarPaymentSignerOptions) {
    this.#network = network;
    this.#passphrase = NETWORK_PASSPHRASE[network];
    this.#keypair = Keypair.fromSecret(secretSeed);
    this.address = this.#keypair.publicKey() as StellarAddress;
    this.#rpcUrl = opts.rpcUrl;
    this.#usdcAsset = opts.usdcAsset;
    this.#ledgerSource = opts.ledgerSource;
    this.#balanceReader = opts.balanceReader;
  }

  get network(): Network {
    return this.#network;
  }

  async createPayment(requirement: PaymentRequirement): Promise<X402PaymentPayload> {
    const sac = deriveSacContractId(requirement.asset, this.#passphrase);
    const amount = BigInt(requirement.maxAmountRequired);

    const currentLedger = await this.#currentLedger();
    const window = Math.max(2, Math.ceil(requirement.maxTimeoutSeconds / SECONDS_PER_LEDGER));
    const validUntilLedger = currentLedger + window;

    const entry = buildTransferAuthEntry({
      sacContractId: sac,
      from: this.address,
      to: requirement.payTo,
      amount,
    });
    const signed = await authorizeEntry(entry, this.#keypair, validUntilLedger, this.#passphrase);

    return {
      x402Version: 1,
      scheme: 'exact',
      network: this.#network,
      settlement: 'x402',
      payload: {
        authorizationEntry: signed.toXDR('base64'),
        from: this.address,
      },
    };
  }

  async getBalance(): Promise<CrawlerBalance> {
    if (!this.#usdcAsset) {
      throw new Error('usdcAsset is required to read the crawler balance');
    }
    const sac = deriveSacContractId(this.#usdcAsset, this.#passphrase);
    const raw = this.#balanceReader
      ? await this.#balanceReader(sac, this.address)
      : await this.#readSacBalance(sac);
    return { available: atomicUsdc(raw) };
  }

  async #currentLedger(): Promise<number> {
    if (this.#ledgerSource) return this.#ledgerSource();
    const { sequence } = await this.#server().getLatestLedger();
    return sequence;
  }

  /** Read the crawler's USDC balance by simulating the SAC `balance(owner)` call. */
  async #readSacBalance(sacContractId: string): Promise<bigint> {
    const source = new Account(this.address, '0');
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: this.#passphrase,
    })
      .addOperation(
        new Contract(sacContractId).call('balance', new Address(this.address).toScVal()),
      )
      .setTimeout(30)
      .build();

    const sim = await this.#server().simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
      throw new Error(`balance read failed: ${'error' in sim ? sim.error : 'no result'}`);
    }
    // SAC `balance` returns an i128, which scValToNative decodes to a bigint. Anything else
    // means the call did not do what we asked; reporting 0 would look like an empty wallet.
    const value: unknown = scValToNative(sim.result.retval);
    if (typeof value !== 'bigint') {
      throw new Error(
        `balance read returned ${sim.result.retval.switch().name}, expected an i128 from the SAC`,
      );
    }
    return value;
  }

  #server(): rpc.Server {
    return new rpc.Server(this.#rpcUrl, { allowHttp: this.#rpcUrl.startsWith('http://') });
  }
}

/** Derive the USDC Stellar Asset Contract address (`C...`) from a `CODE:ISSUER` asset. */
export function deriveSacContractId(asset: string, networkPassphrase: string): string {
  const [code, issuer] = asset.split(':');
  if (!code || !issuer) {
    throw new TypeError(`Invalid asset, expected CODE:ISSUER: ${asset}`);
  }
  return new Asset(code, issuer).contractId(networkPassphrase);
}

/**
 * Build an unsigned Soroban authorization entry for `transfer(from, to, amount)`
 * on the USDC SAC. The expiration ledger and signature are filled in by
 * `authorizeEntry`.
 */
export function buildTransferAuthEntry(input: {
  sacContractId: string;
  from: StellarAddress;
  to: StellarAddress;
  amount: bigint;
}): xdr.SorobanAuthorizationEntry {
  const args = [
    new Address(input.from).toScVal(),
    new Address(input.to).toScVal(),
    nativeToScVal(input.amount, { type: 'i128' }),
  ];

  const rootInvocation = new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
      new xdr.InvokeContractArgs({
        contractAddress: new Address(input.sacContractId).toScAddress(),
        functionName: 'transfer',
        args,
      }),
    ),
    subInvocations: [],
  });

  const credentials = xdr.SorobanCredentials.sorobanCredentialsAddress(
    new xdr.SorobanAddressCredentials({
      address: new Address(input.from).toScAddress(),
      nonce: randomNonce(),
      signatureExpirationLedger: 0,
      signature: xdr.ScVal.scvVoid(),
    }),
  );

  return new xdr.SorobanAuthorizationEntry({ credentials, rootInvocation });
}

/** A random positive 63-bit nonce, the per-authorization replay key. */
function randomNonce(): xdr.Int64 {
  const buf = randomBytes(8);
  buf[0]! &= 0x7f;
  return xdr.Int64.fromString(BigInt('0x' + buf.toString('hex')).toString());
}
