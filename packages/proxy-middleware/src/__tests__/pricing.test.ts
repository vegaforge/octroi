import { describe, expect, it } from 'vitest';
import { atomicUsdc } from '@octroi/types';
import { GlobPricingResolver, globToRegex } from '../pricing';

describe('globToRegex', () => {
  it('* matches any character except /', () => {
    const re = globToRegex('/articles/*');
    expect(re.test('/articles/foo')).toBe(true);
    expect(re.test('/articles/')).toBe(true);
    expect(re.test('/articles/foo/bar')).toBe(false);
  });

  it('** matches across path separators', () => {
    const re = globToRegex('/research/**');
    expect(re.test('/research/foo')).toBe(true);
    expect(re.test('/research/foo/bar/baz')).toBe(true);
    expect(re.test('/research/')).toBe(true);
  });

  it('escapes regex special characters', () => {
    const re = globToRegex('/v1/items.json');
    expect(re.test('/v1/items.json')).toBe(true);
    expect(re.test('/v1/itemsXjson')).toBe(false);
  });
});

describe('GlobPricingResolver', () => {
  const resolver = new GlobPricingResolver(
    [
      { pattern: '/free/**', priceAtomic: atomicUsdc(0n), policy: 'allow' },
      { pattern: '/research/**', priceAtomic: atomicUsdc(2000n), policy: 'charge' },
      { pattern: '/articles/*', priceAtomic: atomicUsdc(100n), policy: 'charge' },
    ],
    atomicUsdc(500n),
  );

  it('returns the price of the first matching rule', () => {
    expect(resolver.resolve('/articles/foo', 'GET')?.priceAtomic).toBe(100n);
    expect(resolver.resolve('/research/papers/abc', 'GET')?.priceAtomic).toBe(2000n);
    expect(resolver.resolve('/free/about', 'GET')?.priceAtomic).toBe(0n);
  });

  it('records which rule matched via ruleId', () => {
    expect(resolver.resolve('/articles/foo', 'GET')?.ruleId).toBe('rule-2:/articles/*');
    expect(resolver.resolve('/about', 'GET')?.ruleId).toBe('default');
  });

  it('falls back to default price when no rule matches', () => {
    expect(resolver.resolve('/about', 'GET')?.priceAtomic).toBe(500n);
  });

  it('accepts full URLs and matches against the path', () => {
    expect(resolver.resolve('https://example.com/articles/foo', 'GET')?.priceAtomic).toBe(100n);
  });
});
