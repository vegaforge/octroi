import { parseOctroiReceipt, type OctroiReceipt } from '@octroi/types';

/** Encode a signed receipt for transport in the `X-PAYMENT-RESPONSE` header. */
export function encodeReceiptHeader(receipt: OctroiReceipt): string {
  return Buffer.from(JSON.stringify(receipt), 'utf-8').toString('base64');
}

/**
 * Decode a receipt from the `X-PAYMENT-RESPONSE` header. Throws if the header is not base64
 * JSON or the JSON is not a receipt. It does not check the signature; use `verifyReceipt`.
 */
export function decodeReceiptHeader(value: string): OctroiReceipt {
  const json: unknown = JSON.parse(Buffer.from(value, 'base64').toString('utf-8'));
  return parseOctroiReceipt(json);
}
