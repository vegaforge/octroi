import { randomBytes } from 'node:crypto';

export interface ProbeResult {
  /** True iff the response shape matches a working CrawlPay middleware. */
  ok: boolean;
  /** HTTP status from the probe request. 0 if the request itself failed. */
  status: number;
  /** Whether a Payment-Required-style header was present. */
  hasPaymentHeader: boolean;
  /** Human-readable summary the dashboard renders verbatim. */
  detail: string;
  /** Probe URL fetched. */
  url: string;
}

const PROBE_TIMEOUT_MS = 10_000;

// GETs a random path on the publisher's domain and checks for working middleware
// (402 + Payment-Required header). Not a security check, just a setup smoke test.
export interface ProbeService {
  probePublisher(domain: string): Promise<ProbeResult>;
}

export class IntegrationProbeService implements ProbeService {
  async probePublisher(domain: string): Promise<ProbeResult> {
    const host = sanitizeDomain(domain);
    const nonce = randomBytes(8).toString('hex');
    const url = `https://${host}/__crawlpay-probe-${nonce}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'user-agent': 'CrawlPay-Integration-Probe/1.0' },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        status: 0,
        hasPaymentHeader: false,
        detail: `Could not reach https://${host}: ${msg}`,
        url,
      };
    }

    const status = response.status;
    const paymentHeader =
      response.headers.get('payment-required') ??
      response.headers.get('x-payment-required') ??
      response.headers.get('www-payment-required');

    if (status === 402 && paymentHeader) {
      return {
        ok: true,
        status,
        hasPaymentHeader: true,
        detail: "Middleware is responding with 402 + Payment-Required. You're live.",
        url,
      };
    }

    if (status === 402) {
      return {
        ok: false,
        status,
        hasPaymentHeader: false,
        detail: 'Got 402 but no Payment-Required header. Check middleware config.',
        url,
      };
    }

    return {
      ok: false,
      status,
      hasPaymentHeader: Boolean(paymentHeader),
      detail: `Expected 402, got ${status}. Is the middleware mounted on this path?`,
      url,
    };
  }
}

/** Stripe-style sanitization: lowercase, drop scheme + path, trim whitespace. */
function sanitizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .trim();
}
