import { verifyReceipt, type ReceiptSigner, type VerificationResult } from '@octroi/receipt-signer';
import type {
  AssetId,
  OctroiErrorCode,
  OctroiReceipt,
  OctroiReceiptBody,
  Network,
  PaymentPayload,
  StellarAddress,
} from '@octroi/types';
import { signReceipt } from '@octroi/receipt-signer';
import type { NonceTracker, ReceiptRepository } from '@octroi/persistence';
import type { SorobanSettlement } from './soroban-settlement';

export interface VerifyInput {
  publisherId: string;
  payTo: StellarAddress;
  resource: string;
  network: Network;
  asset: AssetId;
  maxAmountRequired: string;
  payment: PaymentPayload;
}

export interface VerifySuccess {
  ok: true;
  data: { receipt: OctroiReceipt };
}

export interface VerifyFailure {
  ok: false;
  error: { code: OctroiErrorCode; message: string };
}

export type VerifyResult = VerifySuccess | VerifyFailure;

/** replay-window buffer (seconds) added when reserving a settled nonce */
const NONCE_TTL_SECONDS = 5 * 60;

/**
 * Core facilitator orchestration. Stateless per call (state lives in the injected trackers).
 * verify() validates, settles on Stellar, reserves the nonce as a replay barrier, then
 * signs and persists a receipt.
 */
export class FacilitatorService {
  readonly #settlement: SorobanSettlement;
  readonly #signer: ReceiptSigner;
  readonly #nonces: NonceTracker;
  readonly #receipts: ReceiptRepository;
  readonly #network: Network;

  constructor(deps: {
    settlement: SorobanSettlement;
    signer: ReceiptSigner;
    nonces: NonceTracker;
    receipts: ReceiptRepository;
    network: Network;
  }) {
    this.#settlement = deps.settlement;
    this.#signer = deps.signer;
    this.#nonces = deps.nonces;
    this.#receipts = deps.receipts;
    this.#network = deps.network;
  }

  get signerPublicKey(): StellarAddress {
    return this.#signer.publicKey;
  }

  get receiptsRepository(): ReceiptRepository {
    return this.#receipts;
  }

  async verify(input: VerifyInput): Promise<VerifyResult> {
    if (input.payment.network !== input.network) {
      return {
        ok: false,
        error: { code: 'recipient_mismatch', message: 'payment network does not match the offer' },
      };
    }

    let settled;
    try {
      settled = await this.#settlement.settle({
        payment: input.payment,
        payTo: input.payTo,
        asset: input.asset,
        network: input.network,
        maxAmountRequired: input.maxAmountRequired,
      });
    } catch (err) {
      return {
        ok: false,
        error: {
          code: 'facilitator_error',
          message: err instanceof Error ? err.message : String(err),
        },
      };
    }

    if (!settled.ok) {
      return { ok: false, error: settled.error };
    }

    const reserved = await this.#nonces.reserve(
      settled.nonce,
      Math.floor(Date.now() / 1000) + NONCE_TTL_SECONDS,
    );
    if (!reserved) {
      return {
        ok: false,
        error: { code: 'replay', message: `nonce ${settled.nonce} already used` },
      };
    }

    const receipt = await this.#issueReceipt({
      resource: input.resource,
      from: settled.from,
      to: input.payTo,
      amount: settled.amount,
      asset: input.asset,
      nonce: settled.nonce,
      settlement: input.payment.settlement,
      onchainTxHash: settled.onchainTxHash,
    });

    await this.#receipts.insert(receipt, input.publisherId);

    return { ok: true, data: { receipt } };
  }

  async verifyReceiptSignature(
    receipt: OctroiReceipt,
    expectedSigner?: StellarAddress,
  ): Promise<VerificationResult> {
    return verifyReceipt(receipt, expectedSigner);
  }

  async #issueReceipt(input: {
    resource: string;
    from: StellarAddress;
    to: StellarAddress;
    amount: string;
    asset: AssetId;
    nonce: string;
    settlement: PaymentPayload['settlement'];
    onchainTxHash: string | null;
  }): Promise<OctroiReceipt> {
    const body: Omit<OctroiReceiptBody, 'facilitatorPubkey'> = {
      version: '1',
      resource: input.resource,
      amount: input.amount,
      asset: input.asset,
      network: this.#network,
      from: input.from,
      to: input.to,
      nonce: input.nonce,
      timestamp: new Date().toISOString(),
      settlement: input.settlement,
      onchainTxHash: input.onchainTxHash,
      mppSessionRef: null,
    };
    return signReceipt(body, this.#signer);
  }
}
