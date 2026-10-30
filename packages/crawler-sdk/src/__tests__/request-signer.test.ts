import { describe, it, expect } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import { StellarRequestSigner } from '../request-signer';

describe('StellarRequestSigner', () => {
  const keypair = Keypair.random();
  const signer = new StellarRequestSigner(keypair.secret(), { expirySeconds: 60 });

  it('produces valid Web Bot Auth headers', () => {
    const headers = signer.sign({ authority: 'example.com' });

    expect(headers.signature).toBeTruthy();
    expect(headers.signatureInput).toContain('("@authority")');
    expect(headers.signatureInput).toContain('tag="web-bot-auth"');
    expect(headers.signatureInput).toContain('alg="ed25519"');
    expect(headers.signatureAgent).toBeUndefined();
  });

  it('includes signature-agent when provided', () => {
    const headers = signer.sign({
      authority: 'example.com',
      signatureAgent: 'https://registry.octroi.dev',
    });

    expect(headers.signatureInput).toContain('"signature-agent";key="sig"');
    expect(headers.signatureAgent).toBe('https://registry.octroi.dev');
  });

  it('generates unique nonces', () => {
    const h1 = signer.sign({ authority: 'example.com' });
    const h2 = signer.sign({ authority: 'example.com' });

    const nonce1 = extractNonce(h1.signatureInput);
    const nonce2 = extractNonce(h2.signatureInput);
    expect(nonce1).not.toBe(nonce2);
  });

  it('keyid is consistent across calls', () => {
    const h1 = signer.sign({ authority: 'example.com' });
    const h2 = signer.sign({ authority: 'other.com' });

    const kid1 = extractKeyid(h1.signatureInput);
    const kid2 = extractKeyid(h2.signatureInput);
    expect(kid1).toBe(kid2);
  });

  it('uses the same keyid as the signer', () => {
    expect(signer.keyid).toBeTruthy();
    const headers = signer.sign({ authority: 'example.com' });
    const kid = extractKeyid(headers.signatureInput);
    expect(kid).toBe(signer.keyid);
  });

  it('sets created and expires within expected window', () => {
    const before = Math.floor(Date.now() / 1000);
    const headers = signer.sign({ authority: 'example.com' });
    const after = Math.floor(Date.now() / 1000) + 61;

    const created = extractCreated(headers.signatureInput);
    const expires = extractExpires(headers.signatureInput);

    expect(created).toBeGreaterThanOrEqual(before);
    expect(created).toBeLessThanOrEqual(after);
    expect(expires).toBe(created + 60);
  });
});

function extractNonce(input: string): string {
  const match = input.match(/nonce="([^"]+)"/);
  return match![1]!;
}

function extractKeyid(input: string): string {
  const match = input.match(/keyid="([^"]+)"/);
  return match![1]!;
}

function extractCreated(input: string): number {
  const match = input.match(/created=(\d+)/);
  return Number(match![1]!);
}

function extractExpires(input: string): number {
  const match = input.match(/expires=(\d+)/);
  return Number(match![1]!);
}
