import { createHash, createPublicKey, verify } from 'node:crypto';
import type { SignatureParams, SignatureVerificationResult } from '@octroi/types';
import { WEB_BOT_AUTH_HEADERS } from '@octroi/types';

/**
 * Verifies HTTP Message Signatures (Web Bot Auth).
 */
export interface SignatureVerifier {
  /**
   * Verify a Web Bot Auth signature on a request.
   * @param authority - The request's Host header value.
   * @param headers - The raw HTTP headers (lowercase keys).
   * @returns Verification result with the signer's keyid if valid.
   */
  verify(
    authority: string,
    headers: Record<string, string | string[] | undefined>,
  ): SignatureVerificationResult;
}

export interface SignatureVerifierOptions {
  /** Maximum age of a signature in seconds. Default 300 (5 min). */
  maxAgeSeconds?: number;
  /** Optional nonce validator. Return true if nonce is fresh (not a replay). */
  nonceValidator?: (nonce: string) => boolean;
  /** Map of known keyid (base64url JWK Thumbprint) to raw Ed25519 public key (base64url). */
  knownKeys?: Record<string, string>;
}

/**
 * Verifies Ed25519 HTTP Message Signatures per Web Bot Auth.
 * Checks: header presence, signature params, expiry, and Ed25519 signature.
 */
export class Ed25519SignatureVerifier implements SignatureVerifier {
  readonly #maxAgeSeconds: number;
  readonly #nonceValidator?: (nonce: string) => boolean;
  readonly #knownKeys: Record<string, string>;

  constructor(opts?: SignatureVerifierOptions) {
    this.#maxAgeSeconds = opts?.maxAgeSeconds ?? 300;
    this.#nonceValidator = opts?.nonceValidator;
    this.#knownKeys = opts?.knownKeys ?? {};
  }

  verify(
    authority: string,
    headers: Record<string, string | string[] | undefined>,
  ): SignatureVerificationResult {
    const sigHeader = headerValue(headers[WEB_BOT_AUTH_HEADERS.signature]);
    const inputHeader = headerValue(headers[WEB_BOT_AUTH_HEADERS.signatureInput]);
    const agentHeader = headerValue(headers[WEB_BOT_AUTH_HEADERS.signatureAgent]);

    if (!sigHeader || !inputHeader) {
      return { valid: false, error: 'missing_signature_headers' };
    }

    const params = parseSignatureInput(inputHeader);
    if (!params) {
      return { valid: false, error: 'invalid_signature_input' };
    }

    if (params.tag !== 'web-bot-auth') {
      return { valid: false, error: 'invalid_tag' };
    }

    if (params.alg !== 'ed25519') {
      return { valid: false, error: 'unsupported_algorithm' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (params.created > now + 60) {
      return { valid: false, error: 'signature_not_yet_valid' };
    }
    if (params.expires < now) {
      return { valid: false, error: 'signature_expired' };
    }
    if (params.expires - params.created > this.#maxAgeSeconds) {
      return { valid: false, error: 'signature_too_long_lived' };
    }

    if (this.#nonceValidator && !this.#nonceValidator(params.nonce)) {
      return { valid: false, error: 'nonce_rejected' };
    }

    const publicKeyB64 = this.#knownKeys[params.keyid];
    if (!publicKeyB64) {
      return { valid: false, error: 'unknown_keyid' };
    }

    const signatureBase = buildVerificationBase(authority, agentHeader, params);

    try {
      const keyObject = createPublicKey({
        key: {
          kty: 'OKP',
          crv: 'Ed25519',
          x: publicKeyB64,
        },
        format: 'jwk',
      });

      const verified = verify(
        null,
        Buffer.from(signatureBase, 'utf-8'),
        keyObject,
        Buffer.from(sigHeader, 'base64url'),
      );

      if (!verified) {
        return { valid: false, error: 'signature_mismatch' };
      }
    } catch {
      return { valid: false, error: 'verification_failed' };
    }

    return { valid: true, keyid: params.keyid };
  }
}

/** Extract a single header value from possibly-array headers. */
function headerValue(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

/** Parse the Signature-Input header value into params. */
function parseSignatureInput(input: string): SignatureParams | undefined {
  // Format: sig=(components);created=N;expires=N;keyid="...";alg="...";nonce="...";tag="..."
  const match = input.match(/^sig=\(([^)]+)\);(.+)$/);
  if (!match) return undefined;

  const componentsStr = match[1]!;
  const paramsStr = match[2]!;

  const components = componentsStr.split(/\s+/).map((c) => {
    // Strip quotes and ;key="..." suffix
    const clean = c.replace(/"/g, '').replace(/;key=\w+$/, '');
    return clean;
  });

  const params: Record<string, string> = {};
  for (const part of paramsStr.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    let value = part.slice(eqIdx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    params[key] = value;
  }

  if (!params['created'] || !params['expires'] || !params['keyid'] || !params['nonce']) {
    return undefined;
  }

  return {
    components,
    created: Number(params['created']),
    expires: Number(params['expires']),
    keyid: params['keyid']!,
    alg: params['alg'] ?? 'ed25519',
    nonce: params['nonce']!,
    tag: (params['tag'] ?? 'web-bot-auth') as 'web-bot-auth',
  };
}

/** Reconstruct the signature base for verification per RFC 9421 §2.5. */
function buildVerificationBase(
  authority: string,
  signatureAgent: string | undefined,
  params: SignatureParams,
): string {
  const lines: string[] = [];

  lines.push(`"@authority": ${authority}`);

  if (signatureAgent && params.components.includes('signature-agent')) {
    lines.push(`"signature-agent";key="sig": ${signatureAgent}`);
  }

  const components = params.components
    .map((c) => (c === 'signature-agent' ? `"signature-agent";key="sig"` : `"${c}"`))
    .join(' ');

  const paramParts = [
    components,
    `created=${params.created}`,
    `expires=${params.expires}`,
    `keyid="${params.keyid}"`,
    `alg="${params.alg}"`,
    `nonce="${params.nonce}"`,
    `tag="${params.tag}"`,
  ];

  lines.push(`"@signature-params": ${paramParts.join(';')}`);

  return lines.join('\n');
}
