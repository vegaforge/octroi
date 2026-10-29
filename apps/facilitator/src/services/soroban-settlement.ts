import {
  Address,
  BASE_FEE,
  Keypair,
  Operation,
  TransactionBuilder,
  hash,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import type {
  AssetId,
  ContractAddress,
  OctroiErrorCode,
  Network,
  PaymentPayload,
  StellarAddress,
} from '@octroi/types';
import { NETWORK_PASSPHRASE } from '@octroi/types';

export interface SettleInput {
  /** The crawler's `X-PAYMENT` payload (signed auth entry or MPP debit). */
  payment: PaymentPayload;
  /** Publisher payout address the SAC transfer must pay. */
  payTo: StellarAddress;
  /** USDC asset the transfer must move. */
  asset: AssetId;
  /** Network the settlement must occur on. */
  network: Network;
  /** offered ceiling, authorized amount must not exceed this */
  maxAmountRequired: string;
}

export type SettleResult =
  | {
      ok: true;
      /** Crawler G-address that paid (the SAC transfer `from`). */
      from: StellarAddress;
      /** Amount actually settled, atomic USDC stringified. */
      amount: string;
      /** Authorization nonce, the replay barrier key. */
      nonce: string;
      /** SAC transfer hash for x402; null until bulk settlement for mpp. */
      onchainTxHash: string | null;
    }
  | { ok: false; error: { code: OctroiErrorCode; message: string } };

/** Settles a verified payment on Stellar by submitting the USDC SAC transfer. */
export interface SorobanSettlement {
  settle(input: SettleInput): Promise<SettleResult>;
}

/** Reads the current ledger and submits the pre-authorized transfer. Injectable for tests. */
export interface SettlementGateway {
  currentLedger(): Promise<number>;
  /** Submit the transfer with a sponsored fee; resolve with the on-chain tx hash. */
  submitTransfer(authEntry: xdr.SorobanAuthorizationEntry): Promise<string>;
}

export interface StellarSorobanSettlementOptions {
  rpcUrl: string;
  network: Network;
  /** The USDC SAC the crawler must have authorized. */
  sacAddress: ContractAddress;
  feeSponsorSeed?: string;
  /** Override the Soroban gateway. Used by tests. */
  gateway?: SettlementGateway;
}

function fail(
  code: OctroiErrorCode,
  message: string,
): { ok: false; error: { code: OctroiErrorCode; message: string } } {
  return { ok: false, error: { code, message } };
}

/**
 * Verifies the crawler's authorization against the offer and submits the USDC
 * SAC transfer. Soroban verifies the auth signature again on submit; we pre-check
 * everything here so we never sponsor a fee for a doomed transaction.
 */
export class StellarSorobanSettlement implements SorobanSettlement {
  readonly #network: Network;
  readonly #passphrase: string;
  readonly #sacAddress: ContractAddress;
  readonly #gateway: SettlementGateway;

  constructor(opts: StellarSorobanSettlementOptions) {
    this.#network = opts.network;
    this.#passphrase = NETWORK_PASSPHRASE[opts.network];
    this.#sacAddress = opts.sacAddress;
    this.#gateway =
      opts.gateway ??
      new SorobanGateway({
        rpcUrl: opts.rpcUrl,
        network: opts.network,
        feeSponsorSeed: opts.feeSponsorSeed,
      });
  }

  async settle(input: SettleInput): Promise<SettleResult> {
    if (input.payment.settlement !== 'x402') {
      return fail('facilitator_error', 'MPP session settlement is not implemented yet (issue #7)');
    }
    if (input.network !== this.#network) {
      return fail('recipient_mismatch', 'offer network does not match the facilitator network');
    }

    let entry: xdr.SorobanAuthorizationEntry;
    try {
      entry = xdr.SorobanAuthorizationEntry.fromXDR(
        input.payment.payload.authorizationEntry,
        'base64',
      );
    } catch {
      return fail('invalid_payload', 'authorization entry is not valid base64 XDR');
    }

    const currentLedger = await this.#gateway.currentLedger();
    const checked = validateTransferAuth(entry, {
      sac: this.#sacAddress,
      payTo: input.payTo,
      maxAmount: BigInt(input.maxAmountRequired),
      declaredFrom: input.payment.payload.from,
      passphrase: this.#passphrase,
      currentLedger,
    });
    if (!checked.ok) return checked;

    let onchainTxHash: string;
    try {
      onchainTxHash = await this.#gateway.submitTransfer(entry);
    } catch (err) {
      return fail('facilitator_error', err instanceof Error ? err.message : String(err));
    }

    return {
      ok: true,
      from: checked.from,
      amount: checked.amount.toString(),
      nonce: checked.nonce,
      onchainTxHash,
    };
  }
}

interface AuthContext {
  sac: ContractAddress;
  payTo: StellarAddress;
  maxAmount: bigint;
  declaredFrom: StellarAddress;
  passphrase: string;
  currentLedger: number;
}

type ValidatedAuth =
  | { ok: true; from: StellarAddress; to: StellarAddress; amount: bigint; nonce: string }
  | { ok: false; error: { code: OctroiErrorCode; message: string } };

/**
 * Verify that the signed authorization entry authorizes exactly the offered
 * transfer: the USDC SAC, `transfer(from, to, amount)` with `to == payTo` and
 * `amount <= maxAmountRequired`, signed by `from`, and not expired.
 */
export function validateTransferAuth(
  entry: xdr.SorobanAuthorizationEntry,
  ctx: AuthContext,
): ValidatedAuth {
  if (
    entry.credentials().switch().value !==
    xdr.SorobanCredentialsType.sorobanCredentialsAddress().value
  ) {
    return fail('invalid_signature', 'authorization must use address credentials');
  }
  const addr = entry.credentials().address();
  const from = addressToString(addr.address());
  if (from !== ctx.declaredFrom) {
    return fail('invalid_signature', 'payload `from` does not match the authorization');
  }

  const rootFn = entry.rootInvocation().function();
  if (
    rootFn.switch().value !==
    xdr.SorobanAuthorizedFunctionType.sorobanAuthorizedFunctionTypeContractFn().value
  ) {
    return fail('invalid_payload', 'authorization is not a contract invocation');
  }
  const call = rootFn.contractFn();

  if (addressToString(call.contractAddress()) !== ctx.sac) {
    return fail('invalid_payload', 'authorization is not for the configured USDC contract');
  }
  if (call.functionName().toString() !== 'transfer') {
    return fail('invalid_payload', 'authorization is not a `transfer` call');
  }

  const args = call.args();
  if (args.length !== 3) {
    return fail('invalid_payload', 'transfer must have exactly 3 arguments');
  }
  if (Address.fromScVal(args[0]!).toString() !== from) {
    return fail('invalid_signature', 'transfer `from` does not match the authorizer');
  }
  const to = Address.fromScVal(args[1]!).toString() as StellarAddress;
  if (to !== ctx.payTo) {
    return fail('recipient_mismatch', 'transfer `to` does not match the offer payTo');
  }

  // scValToNative is typed `any`; an i128 decodes to a bigint and anything else is refused.
  const amount: unknown = scValToNative(args[2]!);
  if (typeof amount !== 'bigint' || amount <= 0n) {
    return fail('invalid_payload', 'transfer amount must be a positive integer');
  }
  if (amount > ctx.maxAmount) {
    return fail('amount_exceeded', 'authorized amount exceeds maxAmountRequired');
  }

  if (addr.signatureExpirationLedger() <= ctx.currentLedger) {
    return fail('expired', 'authorization signature window has passed');
  }

  if (!verifyAuthSignature(entry, from, ctx.passphrase)) {
    return fail('invalid_signature', 'authorization signature does not verify');
  }

  return { ok: true, from: from as StellarAddress, to, amount, nonce: addr.nonce().toString() };
}

function addressToString(scAddress: xdr.ScAddress): string {
  return Address.fromScAddress(scAddress).toString();
}

/** Recompute the authorization preimage and check the Ed25519 signature against `from`. */
function verifyAuthSignature(
  entry: xdr.SorobanAuthorizationEntry,
  from: string,
  passphrase: string,
): boolean {
  const addr = entry.credentials().address();
  const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    new xdr.HashIdPreimageSorobanAuthorization({
      networkId: hash(Buffer.from(passphrase)),
      nonce: addr.nonce(),
      invocation: entry.rootInvocation(),
      signatureExpirationLedger: addr.signatureExpirationLedger(),
    }),
  );
  const payload = hash(preimage.toXDR());

  const sigVal = addr.signature();
  if (sigVal.switch().name !== 'scvVec') return false;
  const structs = sigVal.vec() ?? [];

  let keypair: Keypair;
  try {
    keypair = Keypair.fromPublicKey(from);
  } catch {
    return false;
  }

  for (const struct of structs) {
    const fields = struct.map();
    if (!fields) continue;
    const sigField = fields.find(
      (f) => f.key().switch().name === 'scvSymbol' && f.key().sym().toString() === 'signature',
    );
    if (!sigField) continue;
    if (keypair.verify(payload, Buffer.from(sigField.val().bytes()))) return true;
  }
  return false;
}

/** Default gateway: submits the transfer via Soroban RPC with a sponsor-paid fee. */
export class SorobanGateway implements SettlementGateway {
  readonly #server: rpc.Server;
  readonly #passphrase: string;
  readonly #feeSponsorSeed?: string;

  constructor(opts: { rpcUrl: string; network: Network; feeSponsorSeed?: string }) {
    this.#server = new rpc.Server(opts.rpcUrl, { allowHttp: opts.rpcUrl.startsWith('http://') });
    this.#passphrase = NETWORK_PASSPHRASE[opts.network];
    this.#feeSponsorSeed = opts.feeSponsorSeed;
  }

  async currentLedger(): Promise<number> {
    const { sequence } = await this.#server.getLatestLedger();
    return sequence;
  }

  async submitTransfer(authEntry: xdr.SorobanAuthorizationEntry): Promise<string> {
    if (!this.#feeSponsorSeed) {
      throw new Error('OCTROI_FEE_SPONSOR_SEED is required to submit settlements');
    }
    const sponsor = Keypair.fromSecret(this.#feeSponsorSeed);

    const func = xdr.HostFunction.hostFunctionTypeInvokeContract(
      authEntry.rootInvocation().function().contractFn(),
    );
    const op = Operation.invokeHostFunction({ func, auth: [authEntry] });

    const source = await this.#server.getAccount(sponsor.publicKey());
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: this.#passphrase,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    const sim = await this.#server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim)) {
      throw new Error(`simulation failed: ${'error' in sim ? sim.error : 'unknown'}`);
    }
    const prepared = rpc.assembleTransaction(tx, sim).build();
    prepared.sign(sponsor);

    const sent = await this.#server.sendTransaction(prepared);
    if (sent.status === 'ERROR') {
      throw new Error(`settlement rejected: ${JSON.stringify(sent.errorResult)}`);
    }
    return this.#awaitConfirmation(sent.hash);
  }

  async #awaitConfirmation(hash: string): Promise<string> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const res = await this.#server.getTransaction(hash);
      if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) return hash;
      if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error('settlement transaction failed on-chain');
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error('settlement transaction was not confirmed in time');
  }
}
