import type { MppPaymentPayload, PaymentPayload, X402PaymentPayload } from '@octroi/types';
import { NETWORKS, isStellarAddress } from '@octroi/types';

export type ParsedPayment = { ok: true; value: PaymentPayload } | { ok: false; error: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNetwork(v: unknown): v is PaymentPayload['network'] {
  return typeof v === 'string' && (NETWORKS as readonly string[]).includes(v);
}

/**
 * Parse the crawler's `payment` object from a `/verify` body into a typed payload.
 * `exact` is the only scheme Octroi settles, so anything else is refused here, before the
 * service sees it.
 */
export function parsePaymentPayload(raw: unknown): ParsedPayment {
  if (!isObject(raw)) {
    return { ok: false, error: 'payment required (object)' };
  }
  if (raw.x402Version !== 1) {
    return { ok: false, error: 'payment.x402Version must be 1' };
  }
  if (raw.scheme !== 'exact') {
    return { ok: false, error: 'payment.scheme must be "exact"' };
  }
  if (!isNetwork(raw.network)) {
    return { ok: false, error: `payment.network must be one of ${NETWORKS.join(', ')}` };
  }
  const inner = raw.payload;
  if (!isObject(inner)) {
    return { ok: false, error: 'payment.payload required (object)' };
  }

  if (raw.settlement === 'x402') {
    if (typeof inner.authorizationEntry !== 'string' || inner.authorizationEntry.length === 0) {
      return { ok: false, error: 'payment.payload.authorizationEntry required (base64 XDR)' };
    }
    if (typeof inner.from !== 'string' || !isStellarAddress(inner.from)) {
      return { ok: false, error: 'payment.payload.from required (Stellar G-address)' };
    }
    const value: X402PaymentPayload = {
      x402Version: 1,
      scheme: 'exact',
      network: raw.network,
      settlement: 'x402',
      payload: { authorizationEntry: inner.authorizationEntry, from: inner.from },
    };
    return { ok: true, value };
  }

  if (raw.settlement === 'mpp') {
    if (typeof inner.sessionId !== 'string' || inner.sessionId.length === 0) {
      return { ok: false, error: 'payment.payload.sessionId required (non-empty string)' };
    }
    if (typeof inner.amount !== 'string' || !/^\d+$/.test(inner.amount)) {
      return { ok: false, error: 'payment.payload.amount required (atomic USDC string)' };
    }
    const value: MppPaymentPayload = {
      x402Version: 1,
      scheme: 'exact',
      network: raw.network,
      settlement: 'mpp',
      payload: { sessionId: inner.sessionId, amount: inner.amount },
    };
    return { ok: true, value };
  }

  return { ok: false, error: 'payment.settlement must be "x402" or "mpp"' };
}
