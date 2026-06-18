import type { OctroiReceipt } from '@octroi/types';

/** Encode a signed receipt for transport in the `X-PAYMENT-RESPONSE` header. */
export function encodeReceiptHeader(receipt: OctroiReceipt): string {
  return Buffer.from(JSON.stringify(receipt), 'utf-8').toString('base64');
}

/** Decode a receipt from the `X-PAYMENT-RESPONSE` header. */
export function decodeReceiptHeader(value: string): OctroiReceipt {
  return JSON.parse(Buffer.from(value, 'base64').toString('utf-8'));
}
