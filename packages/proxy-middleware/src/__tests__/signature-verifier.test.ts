import { describe, it, expect, vi } from 'vitest';
import { Keypair } from '@stellar/stellar-base';
import { randomBytes, createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { StellarAddress, AtomicUsdc } from '@octroi/types';
import { Ed25519SignatureVerifier } from '../signature-verifier';
import { octroi } from '../express';

/** Compute the JWK Thumbprint (base64url) of an Ed25519 public key. */
function computeKeyid(publicKey: Uint8Array): string {
  const jwk = {
    kty: 'OKP',
    crv: 'Ed25519',
    x: Buffer.from(publicKey).toString('base64url'),
  };
  return createHash('sha256').update(JSON.stringify(jwk)).digest().toString('base64url');
}

/** Build a signature base and sign it with the given keypair. */
function signRequest(
  keypair: Keypair,
  authority: string,
  opts?: { signatureAgent?: string; expirySeconds?: number },
) {
  const now = Math.floor(Date.now() / 1000);
  const expirySeconds = opts?.expirySeconds ?? 60;
  const nonce = randomBytes(64).toString('base64url');

  const components = opts?.signatureAgent ? ['@authority', 'signature-agent'] : ['@authority'];

  const lines: string[] = [];
  lines.push(`"@authority": ${authority}`);
  if (opts?.signatureAgent) {
    lines.push(`"signature-agent";key="sig": ${opts.signatureAgent}`);
  }

  const componentsStr = components
    .map((c) => (c === 'signature-agent' ? `"signature-agent";key="sig"` : `"${c}"`))
    .join(' ');

  const paramParts = [
    componentsStr,
    `created=${now}`,
    `expires=${now + expirySeconds}`,
    `keyid="${computeKeyid(keypair.rawPublicKey())}"`,
    `alg="ed25519"`,
    `nonce="${nonce}"`,
    `tag="web-bot-auth"`,
  ];

  lines.push(`"@signature-params": ${paramParts.join(';')}`);

  const signatureBase = lines.join('\n');
  const signatureBytes = keypair.sign(Buffer.from(signatureBase, 'utf-8'));
  const signature = Buffer.from(signatureBytes).toString('base64url');

  const signatureInput = `sig=(${componentsStr});created=${now};expires=${now + expirySeconds};keyid="${computeKeyid(keypair.rawPublicKey())}";alg="ed25519";nonce="${nonce}";tag="web-bot-auth"`;

  return { signature, signatureInput, signatureAgent: opts?.signatureAgent };
}

describe('Ed25519SignatureVerifier', () => {
  const keypair = Keypair.random();
  const keyid = computeKeyid(keypair.rawPublicKey());
  const publicKeyB64 = Buffer.from(keypair.rawPublicKey()).toString('base64url');

  const verifier = new Ed25519SignatureVerifier({
    maxAgeSeconds: 300,
    knownKeys: { [keyid]: publicKeyB64 },
  });

  it('rejects requests without signature headers', () => {
    const result = verifier.verify('example.com', {});
    expect(result.valid).toBe(false);
    expect(result.error).toBe('missing_signature_headers');
  });

  it('rejects signatures with wrong tag', () => {
    const headers = {
      signature: 'abc',
      'signature-input':
        'sig=("@authority");created=1;expires=999;keyid="kid";alg="ed25519";nonce="n";tag="wrong"',
    };
    const result = verifier.verify('example.com', headers);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_tag');
  });

  it('rejects expired signatures', () => {
    const past = Math.floor(Date.now() / 1000) - 100;
    const headers = {
      signature: 'abc',
      'signature-input': `sig=("@authority");created=${past};expires=${past + 10};keyid="kid";alg="ed25519";nonce="n";tag="web-bot-auth"`,
    };
    const result = verifier.verify('example.com', headers);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('signature_expired');
  });

  it('rejects signatures with unsupported algorithm', () => {
    const now = Math.floor(Date.now() / 1000);
    const headers = {
      signature: 'abc',
      'signature-input': `sig=("@authority");created=${now};expires=${now + 60};keyid="kid";alg="rsa-pss-sha512";nonce="n";tag="web-bot-auth"`,
    };
    const result = verifier.verify('example.com', headers);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('unsupported_algorithm');
  });

  it('rejects signatures that are too long-lived', () => {
    const shortVerifier = new Ed25519SignatureVerifier({ maxAgeSeconds: 60 });
    const now = Math.floor(Date.now() / 1000);
    const headers = {
      signature: 'abc',
      'signature-input': `sig=("@authority");created=${now};expires=${now + 300};keyid="kid";alg="ed25519";nonce="n";tag="web-bot-auth"`,
    };
    const result = shortVerifier.verify('example.com', headers);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('signature_too_long_lived');
  });

  it('rejects nonces that fail the nonce validator', () => {
    const nonceVerifier = new Ed25519SignatureVerifier({
      nonceValidator: () => false,
      knownKeys: { [keyid]: publicKeyB64 },
    });
    const now = Math.floor(Date.now() / 1000);
    const headers = {
      signature: 'abc',
      'signature-input': `sig=("@authority");created=${now};expires=${now + 60};keyid="${keyid}";alg="ed25519";nonce="replayed";tag="web-bot-auth"`,
    };
    const result = nonceVerifier.verify('example.com', headers);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('nonce_rejected');
  });

  it('rejects unknown keyids', () => {
    const now = Math.floor(Date.now() / 1000);
    const headers = {
      signature: 'abc',
      'signature-input': `sig=("@authority");created=${now};expires=${now + 60};keyid="unknown";alg="ed25519";nonce="n";tag="web-bot-auth"`,
    };
    const result = verifier.verify('example.com', headers);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('unknown_keyid');
  });

  it('verifies a valid signed request', () => {
    const signed = signRequest(keypair, 'example.com');

    const headers = {
      signature: signed.signature,
      'signature-input': signed.signatureInput,
      'signature-agent': signed.signatureAgent,
    };

    const result = verifier.verify('example.com', headers);
    expect(result.valid).toBe(true);
    expect(result.keyid).toBe(keyid);
  });

  it('verifies a valid signed request with signature-agent', () => {
    const signed = signRequest(keypair, 'example.com', {
      signatureAgent: 'https://registry.octroi.dev',
    });

    const headers = {
      signature: signed.signature,
      'signature-input': signed.signatureInput,
      'signature-agent': signed.signatureAgent,
    };

    const result = verifier.verify('example.com', headers);
    expect(result.valid).toBe(true);
    expect(result.keyid).toBe(keyid);
  });

  it('rejects a request signed for a different authority', () => {
    const signed = signRequest(keypair, 'example.com');

    const headers = {
      signature: signed.signature,
      'signature-input': signed.signatureInput,
    };

    const result = verifier.verify('other.com', headers);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('signature_mismatch');
  });
});

describe('middleware signature verification', () => {
  const keypair = Keypair.random();
  const keyid = computeKeyid(keypair.rawPublicKey());
  const publicKeyB64 = Buffer.from(keypair.rawPublicKey()).toString('base64url');

  function createMockReq(authority: string, headers: Record<string, string> = {}) {
    return {
      method: 'GET',
      originalUrl: '/article',
      protocol: 'http',
      ip: '127.0.0.1',
      headers: { host: authority, 'user-agent': 'GPTBot/1.0', ...headers },
      get: (name: string) => headers[name] ?? (name === 'host' ? authority : undefined),
    } as unknown as Request;
  }

  function createMockRes() {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      locals: {},
    } as unknown as Response;
    return res;
  }

  it('rejects crawler requests without valid signature when verifier is configured', () => {
    const sigVerifier = new Ed25519SignatureVerifier({ knownKeys: { [keyid]: publicKeyB64 } });
    const middleware = octroi({
      publisherId: 'test',
      publisherWallet: 'GADEW5MW5OFWO5XVE4JXVBM3QDA5UEKBY3K4OGJMOCYVDLSOIGE2SC6L' as StellarAddress,
      asset: 'USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      network: 'stellar-testnet',
      facilitatorUrl: 'http://localhost:3001',
      defaultPrice: 1000n as AtomicUsdc,
      signatureVerifier: sigVerifier,
    });

    const req = createMockReq('example.com');
    const res = createMockRes();
    const next = vi.fn() as unknown as NextFunction;

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'invalid_signature' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through crawler requests with valid signature', () => {
    const sigVerifier = new Ed25519SignatureVerifier({ knownKeys: { [keyid]: publicKeyB64 } });
    const facilitator = {
      verify: vi.fn().mockResolvedValue({
        ok: true,
        receipt: { from: 'test', amount: '1000' },
      }),
    };
    const middleware = octroi({
      publisherId: 'test',
      publisherWallet: 'GADEW5MW5OFWO5XVE4JXVBM3QDA5UEKBY3K4OGJMOCYVDLSOIGE2SC6L' as StellarAddress,
      asset: 'USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      network: 'stellar-testnet',
      facilitatorUrl: 'http://localhost:3001',
      defaultPrice: 1000n as AtomicUsdc,
      signatureVerifier: sigVerifier,
      facilitator,
    });

    const signed = signRequest(keypair, 'example.com');
    const req = createMockReq('example.com', {
      signature: signed.signature,
      'signature-input': signed.signatureInput,
    });
    const res = createMockRes();
    const next = vi.fn() as unknown as NextFunction;

    middleware(req, res, next);

    // Should get a 402 x402 offer (not invalid_signature), meaning signature check passed
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ x402Version: 1, accepts: expect.any(Array) }),
    );
  });
});
