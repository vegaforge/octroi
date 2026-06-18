import { describe, expect, it } from 'vitest';
import { Keypair } from '@stellar/stellar-base';
import type { StellarAddress } from '@octroi/types';
import { atomicUsdc } from '@octroi/types';
import { MemoryPublisherRepository } from '../publishers/memory';
import { PublisherAlreadyExistsError } from '../publishers/interface';

const WALLET = Keypair.random().publicKey() as StellarAddress;

function makeInput(overrides: Partial<{ id: string; domain: string }> = {}) {
  return {
    id: 'pub_a',
    domain: 'example.com',
    walletAddress: WALLET,
    network: 'stellar-testnet' as const,
    ...overrides,
  };
}

describe('MemoryPublisherRepository', () => {
  it('creates and retrieves by id and domain', async () => {
    const repo = new MemoryPublisherRepository();
    const created = await repo.create(makeInput());
    expect(created.id).toBe('pub_a');
    expect(created.domain).toBe('example.com');
    expect(created.defaultPriceAtomic).toBe(1000n);
    expect(created.active).toBe(true);
    expect(created.minReputationScore).toBe(0);
    expect(created.robotsTxtAware).toBe(true);

    expect(await repo.get('pub_a')).toEqual(created);
    expect(await repo.getByDomain('example.com')).toEqual(created);
    expect(await repo.get('nope')).toBeNull();
    expect(await repo.getByDomain('nope.com')).toBeNull();
  });

  it('throws PublisherAlreadyExistsError on duplicate id', async () => {
    const repo = new MemoryPublisherRepository();
    await repo.create(makeInput());
    await expect(repo.create(makeInput({ domain: 'other.com' }))).rejects.toBeInstanceOf(
      PublisherAlreadyExistsError,
    );
  });

  it('throws PublisherAlreadyExistsError on duplicate domain', async () => {
    const repo = new MemoryPublisherRepository();
    await repo.create(makeInput());
    await expect(repo.create(makeInput({ id: 'pub_b' }))).rejects.toBeInstanceOf(
      PublisherAlreadyExistsError,
    );
  });

  it('applies provided overrides (price, description, reputation)', async () => {
    const repo = new MemoryPublisherRepository();
    const p = await repo.create({
      ...makeInput(),
      defaultPriceAtomic: atomicUsdc(2000n),
      description: 'AI-friendly research mirror',
      minReputationScore: 50,
    });
    expect(p.defaultPriceAtomic).toBe(2000n);
    expect(p.description).toBe('AI-friendly research mirror');
    expect(p.minReputationScore).toBe(50);
  });

  it('list filters by active and network, sorted newest-first', async () => {
    let t = 1000;
    const repo = new MemoryPublisherRepository(() => new Date(t * 1000));
    await repo.create(makeInput({ id: 'pub_a', domain: 'a.com' }));
    t = 2000;
    const b = await repo.create({ ...makeInput({ id: 'pub_b', domain: 'b.com' }), active: false });
    t = 3000;
    await repo.create(makeInput({ id: 'pub_c', domain: 'c.com' }));

    const all = await repo.list();
    expect(all.map((p) => p.id)).toEqual(['pub_c', 'pub_b', 'pub_a']);

    const activeOnly = await repo.list({ active: true });
    expect(activeOnly.map((p) => p.id)).toEqual(['pub_c', 'pub_a']);
    expect(activeOnly).not.toContain(b);

    expect(await repo.count({ active: true })).toBe(2);
  });

  it('honors limit and offset', async () => {
    const repo = new MemoryPublisherRepository();
    for (let i = 0; i < 5; i += 1) {
      await repo.create(makeInput({ id: `pub_${i}`, domain: `${i}.com` }));
    }
    const page = await repo.list({ limit: 2, offset: 1 });
    expect(page.length).toBe(2);
  });
});
