/** Error codes for 402 responses and verification failures. Public set mirrors PRD §9.7; internal codes appended. */
export type OctroiErrorCode =
  // Protocol errors (PRD §9.7)
  | 'invalid_signature'
  | 'invalid_request_signature'
  | 'amount_exceeded'
  | 'recipient_mismatch'
  | 'replay'
  | 'expired'
  | 'insufficient_balance'
  | 'reputation_too_low'
  | 'offer_changed'
  | 'crawler_banned'
  | 'rate_limited'
  | 'session_budget_exhausted'
  | 'facilitator_error'
  | 'facilitator_unavailable'
  // internal: SDK/middleware only
  | 'invalid_payload'
  | 'unexpected_error';

export class OctroiError extends Error {
  constructor(
    public readonly code: OctroiErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'OctroiError';
  }
}
