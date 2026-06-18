import type { OctroiReceipt } from '@octroi/types';

const BASE = '/api';

export interface ReceiptListPagination {
  total: number;
  limit: number;
  offset: number;
}

export interface PublisherReceiptsResponse {
  publisher: { id: string; domain: string };
  receipts: OctroiReceipt[];
  pagination: ReceiptListPagination;
}

export interface CrawlerReceiptsResponse {
  crawler: { walletAddress: string };
  receipts: OctroiReceipt[];
  pagination: ReceiptListPagination;
}

export interface VerifyReceiptResponse {
  valid: boolean;
  /** G-address the signature was checked against (the facilitator key). */
  signerPubkey: string;
  /** Set when `valid=false`. */
  reason?: string;
}

export class ReceiptsApiError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
    public readonly status?: number,
  ) {
    super(message ?? code);
    this.name = 'ReceiptsApiError';
  }
}

async function readError(res: Response): Promise<ReceiptsApiError> {
  let code = `status_${res.status}`;
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) code = body.error;
  } catch {
    /* not JSON */
  }
  return new ReceiptsApiError(code, undefined, res.status);
}

function qs(params: Record<string, string | number | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : '';
}

export async function getPublisherReceipts(
  publisherId: string,
  params: { limit?: number; offset?: number } = {},
): Promise<PublisherReceiptsResponse> {
  const res = await fetch(`${BASE}/publishers/${publisherId}/receipts${qs(params)}`);
  if (!res.ok) throw await readError(res);
  return (await res.json()) as PublisherReceiptsResponse;
}

export async function getCrawlerReceipts(
  wallet: string,
  params: { limit?: number; offset?: number } = {},
): Promise<CrawlerReceiptsResponse> {
  const res = await fetch(`${BASE}/crawlers/${wallet}/receipts${qs(params)}`);
  if (!res.ok) throw await readError(res);
  return (await res.json()) as CrawlerReceiptsResponse;
}

export async function verifyReceipt(
  receipt: OctroiReceipt,
  expectedSigner?: string,
): Promise<VerifyReceiptResponse> {
  const res = await fetch(`${BASE}/receipts/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ receipt, expectedSigner }),
  });
  if (!res.ok) throw await readError(res);
  return (await res.json()) as VerifyReceiptResponse;
}
