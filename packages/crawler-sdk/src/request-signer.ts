import { randomBytes, createHash } from 'node:crypto';
import { Keypair } from '@stellar/stellar-sdk';
import type { SignatureParams, WebBotAuthHeaders } from '@octroi/types';

/**
 * Signs HTTP requests with Web Bot Auth (HTTP Message Signatures).
 * The crawler's Stellar Ed25519 key is used for signing.
 */
export interface RequestSigner {
  /** The signer's keyid (base64url JWK Thumbprint of the public key). */
  readonly keyid: string;
  /** Build Web Bot Auth headers for a request. */
  sign(request: SignableRequest): WebBotAuthHeaders;
}

export interface SignableRequest {
  /** The host authority (e.g. "example.com" or "example.com:8080"). */
  authority: string;
  /** Optional signature-agent header value. */
  signatureAgent?: string;
}

/** Default signature validity window (seconds). */
const DEFAULT_EXPIRY_SECONDS = 300;

/**
 * Signs requests using the crawler's Stellar Ed25519 key.
 * Produces RFC 9421 HTTP Message Signatures with the web-bot-auth tag.
 */
export class StellarRequestSigner implements RequestSigner {
  readonly keyid: string;
  readonly #keypair: Keypair;
  readonly #expirySeconds: number;

  constructor(secretSeed: string, opts?: { expirySeconds?: number }) {
    this.#keypair = Keypair.fromSecret(secretSeed);
    this.keyid = computeKeyid(this.#keypair.rawPublicKey());
    this.#expirySeconds = opts?.expirySeconds ?? DEFAULT_EXPIRY_SECONDS;
  }

  sign(request: SignableRequest): WebBotAuthHeaders {
    const now = Math.floor(Date.now() / 1000);
    const nonce = generateNonce();

    const params: SignatureParams = {
      components: request.signatureAgent ? ['@authority', 'signature-agent'] : ['@authority'],
      created: now,
      expires: now + this.#expirySeconds,
      keyid: this.keyid,
      alg: 'ed25519',
      nonce,
      tag: 'web-bot-auth',
    };

    const signatureBase = buildSignatureBase(request, params);
    const signatureBytes = this.#keypair.sign(Buffer.from(signatureBase, 'utf-8'));
    const signature = Buffer.from(signatureBytes).toString('base64url');

    return {
      signature,
      signatureInput: formatSignatureInput(params),
      signatureAgent: request.signatureAgent,
    };
  }
}

/** Compute the JWK Thumbprint (base64url) of an Ed25519 public key per RFC 7638. */
function computeKeyid(publicKey: Uint8Array): string {
  const jwk = {
    kty: 'OKP',
    crv: 'Ed25519',
    x: Buffer.from(publicKey).toString('base64url'),
  };
  const thumbprint = createHash('sha256').update(JSON.stringify(jwk)).digest();
  return thumbprint.toString('base64url');
}

/** Generate a base64url-encoded 64-byte nonce. */
function generateNonce(): string {
  return randomBytes(64).toString('base64url');
}

/** Build the signature base string per RFC 9421 §2.5. */
function buildSignatureBase(request: SignableRequest, params: SignatureParams): string {
  const lines: string[] = [];

  lines.push(`"@authority": ${request.authority}`);

  if (request.signatureAgent) {
    lines.push(`"signature-agent";key="sig": ${request.signatureAgent}`);
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

/** Format the Signature-Input header value. */
function formatSignatureInput(params: SignatureParams): string {
  const components = params.components
    .map((c) => (c === 'signature-agent' ? `"signature-agent";key="sig"` : `"${c}"`))
    .join(' ');

  return `sig=(${components});created=${params.created};expires=${params.expires};keyid="${params.keyid}";alg="${params.alg}";nonce="${params.nonce}";tag="${params.tag}"`;
}
