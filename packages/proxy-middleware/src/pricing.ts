import type { AtomicUsdc, PricingRule } from '@crawlpay/types';

export interface PricingDecision {
  priceAtomic: AtomicUsdc;
  /** Id of the matched rule, or "default". */
  ruleId: string;
}

export interface PricingResolver {
  /** Return the price for a URL+method, or null to mark the path as free. */
  resolve(url: string, method: string): PricingDecision | null;
}

/**
 * Glob pricing resolver. `*` matches anything but `/`, `**` matches across `/`.
 * Rules checked in order, first match wins, else defaultPrice. priceAtomic 0n marks a free path (skipped).
 */
export class GlobPricingResolver implements PricingResolver {
  readonly #compiled: Array<{ rule: PricingRule; regex: RegExp; id: string }>;
  readonly #defaultPrice: AtomicUsdc;

  constructor(rules: PricingRule[], defaultPrice: AtomicUsdc) {
    this.#compiled = rules.map((rule, i) => ({
      rule,
      regex: globToRegex(rule.pattern),
      id: `rule-${i}:${rule.pattern}`,
    }));
    this.#defaultPrice = defaultPrice;
  }

  resolve(url: string, _method: string): PricingDecision | null {
    const path = pathOf(url);
    for (const { rule, regex, id } of this.#compiled) {
      if (regex.test(path)) {
        return { priceAtomic: rule.priceAtomic, ruleId: id };
      }
    }
    return { priceAtomic: this.#defaultPrice, ruleId: 'default' };
  }
}

/** Extract the path portion of a URL (accepts both full URLs and path-only). */
function pathOf(url: string): string {
  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return url;
  }
}

/** Compile a glob pattern into an anchored RegExp. Exposed for testing. */
export function globToRegex(pattern: string): RegExp {
  let out = '^';
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i]!;
    if (c === '*' && pattern[i + 1] === '*') {
      out += '.*';
      i += 2;
    } else if (c === '*') {
      out += '[^/]*';
      i += 1;
    } else if (/[.+?^${}()|[\]\\]/.test(c)) {
      out += '\\' + c;
      i += 1;
    } else {
      out += c;
      i += 1;
    }
  }
  out += '$';
  return new RegExp(out);
}
