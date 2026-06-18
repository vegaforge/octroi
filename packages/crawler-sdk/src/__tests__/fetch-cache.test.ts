import { describe, expect, it } from 'vitest';
import { atomicUsdc } from '@octroi/types';
import { MemoryFetchCache } from '../fetch-cache';

function makeEntry(url: string, cachedAt: number) {
  return {
    url,
    status: 200,
    data: { hello: url },
    receipt: null,
    paid: atomicUsdc(100n),
    cachedAt,
  };
}

describe('MemoryFetchCache', () => {
  it('returns an entry within the max-age window', async () => {
    let now = 1000;
    const cache = new MemoryFetchCache(() => now);
    await cache.put(makeEntry('https://a/x', now));
    now = 1100;
    const hit = await cache.get('https://a/x', 200);
    expect(hit?.data).toEqual({ hello: 'https://a/x' });
  });

  it('returns null when the entry is older than max-age', async () => {
    let now = 1000;
    const cache = new MemoryFetchCache(() => now);
    await cache.put(makeEntry('https://a/x', now));
    now = 2000;
    expect(await cache.get('https://a/x', 500)).toBeNull();
  });

  it('returns null when the URL was never cached', async () => {
    const cache = new MemoryFetchCache(() => 0);
    expect(await cache.get('https://nope', 60)).toBeNull();
  });

  it('invalidate removes an entry', async () => {
    const cache = new MemoryFetchCache(() => 1000);
    await cache.put(makeEntry('https://a/x', 1000));
    await cache.invalidate('https://a/x');
    expect(await cache.get('https://a/x', 60)).toBeNull();
  });

  it('clear empties the cache', async () => {
    const cache = new MemoryFetchCache(() => 1000);
    await cache.put(makeEntry('https://a/x', 1000));
    await cache.put(makeEntry('https://a/y', 1000));
    await cache.clear();
    expect(await cache.get('https://a/x', 60)).toBeNull();
    expect(await cache.get('https://a/y', 60)).toBeNull();
  });
});
