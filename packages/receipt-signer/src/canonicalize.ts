import type { OctroiReceipt, OctroiReceiptBody } from '@octroi/types';

/** Canonical JSON: keys sorted recursively, no whitespace, signature/undefined dropped. Deterministic so receipts hash the same everywhere. */
export function canonicalizeReceipt(receipt: OctroiReceiptBody | OctroiReceipt): string {
  const asAny = receipt as OctroiReceipt;
  const body: Record<string, unknown> = { ...asAny };
  delete body.signature;
  return canonicalize(body);
}

function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') {
    return JSON.stringify(value);
  }
  if (typeof value === 'bigint') {
    return JSON.stringify(value.toString());
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}';
  }
  throw new TypeError(`Cannot canonicalize value of type ${typeof value}`);
}
