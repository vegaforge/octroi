/**
 * Typed client for the api-gateway's /publishers/* endpoints.
 * Routes through the /api/* rewrite; mutations and probe carry the Bearer key.
 */

import { getStoredApiKey } from '@/hooks/useApiKey';

const BASE = '/api/publishers';

export interface PublisherRecord {
  id: string;
  domain: string;
  /** Stellar payout G-address. */
  walletAddress: string;
  octroiAgentId?: string;
  defaultPriceAtomic: string;
  network: 'stellar-testnet' | 'stellar-mainnet';
  minReputationScore: number;
  robotsTxtAware: boolean;
  active: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePublisherBody {
  domain: string;
  /** Stellar payout G-address. */
  walletAddress: string;
  defaultPriceAtomic?: string | number;
  description?: string;
}

export interface CreatePublisherResult {
  publisher: PublisherRecord;
  /** Shown to the publisher once at onboarding; never returned again. */
  apiKey: string;
}

export interface ProbeResult {
  ok: boolean;
  status: number;
  hasPaymentHeader: boolean;
  detail: string;
  url: string;
}

export class PublishersApiError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
    public readonly status?: number,
  ) {
    super(message ?? code);
    this.name = 'PublishersApiError';
  }
}

async function readError(res: Response): Promise<PublishersApiError> {
  let code = `status_${res.status}`;
  let detail: string | undefined;
  try {
    const body = (await res.json()) as { error?: string; detail?: string };
    code = body.error ?? code;
    detail = body.detail;
  } catch {
    // not JSON
  }
  return new PublishersApiError(code, detail, res.status);
}

function authHeaders(): Record<string, string> {
  const key = getStoredApiKey();
  return key ? { authorization: `Bearer ${key}` } : {};
}

export async function createPublisher(body: CreatePublisherBody): Promise<CreatePublisherResult> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await readError(res);
  return (await res.json()) as CreatePublisherResult;
}

export async function getPublisher(id: string): Promise<PublisherRecord | null> {
  const res = await fetch(`${BASE}/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw await readError(res);
  const data = (await res.json()) as { publisher: PublisherRecord };
  return data.publisher;
}

export async function probePublisher(id: string): Promise<ProbeResult> {
  const res = await fetch(`${BASE}/${id}/probe`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw await readError(res);
  return (await res.json()) as ProbeResult;
}
