/**
 * Web Bot Auth (HTTP Message Signatures) types.
 * Per draft-meunier-web-bot-auth-architecture and RFC 9421.
 */

/** Components that can be signed in the signature base. */
export interface SignatureComponents {
  /** The @authority component (host). */
  authority: string;
  /** The signature-agent header value, if present. */
  signatureAgent?: string;
}

/** Parameters for the @signature-params directive. */
export interface SignatureParams {
  /** List of component identifiers in order. */
  components: string[];
  /** Unix timestamp when the signature was created. */
  created: number;
  /** Unix timestamp when the signature expires. */
  expires: number;
  /** Base64url-encoded JWK Thumbprint of the signing key. */
  keyid: string;
  /** Signing algorithm (e.g. "ed25519"). */
  alg: string;
  /** Base64url-encoded random nonce for replay protection. */
  nonce: string;
  /** Must be "web-bot-auth". */
  tag: 'web-bot-auth';
}

/** The three Web Bot Auth headers the crawler sends. */
export interface WebBotAuthHeaders {
  /** Base64url-encoded Ed25519 signature over the signature base. */
  signature: string;
  /** Structured field containing the signature params. */
  signatureInput: string;
  /** Optional: the agent's signing directory URL or identifier. */
  signatureAgent?: string;
}

/** Result of verifying a Web Bot Auth signature. */
export interface SignatureVerificationResult {
  valid: boolean;
  /** The signer's public key (base64url), extracted from keyid. */
  keyid?: string;
  /** Error reason if invalid. */
  error?: string;
}
