import type { AtomicUsdc, CrawlerBudgetState } from '@octroi/types';
import { atomicUsdc } from '@octroi/types';

export interface BudgetTracker {
  /** Get the current day's spend + remaining (UTC). */
  getState(): Promise<CrawlerBudgetState>;
  /** True if `amount` would fit within the remaining daily budget. */
  canSpend(amount: AtomicUsdc): Promise<boolean>;
  /** Record a spend against today's budget. Not idempotent, accumulates. */
  recordSpend(amount: AtomicUsdc): Promise<void>;
}

/**
 * In-process budget tracker. Resets at UTC midnight. Not safe across processes;
 * for multiple workers back BudgetTracker with Redis/Postgres so the budget is shared.
 */
export class InMemoryBudgetTracker implements BudgetTracker {
  readonly #dailyBudget: AtomicUsdc;
  #spent: AtomicUsdc;
  #date: string;
  readonly #now: () => Date;

  constructor(dailyBudget: AtomicUsdc, now: () => Date = () => new Date()) {
    this.#dailyBudget = dailyBudget;
    this.#spent = atomicUsdc(0n);
    this.#now = now;
    this.#date = this.#today();
  }

  async getState(): Promise<CrawlerBudgetState> {
    this.#rollIfNewDay();
    return {
      date: this.#date,
      spentAtomic: this.#spent,
      remainingAtomic: atomicUsdc(this.#dailyBudget - this.#spent),
    };
  }

  async canSpend(amount: AtomicUsdc): Promise<boolean> {
    this.#rollIfNewDay();
    return this.#spent + amount <= this.#dailyBudget;
  }

  async recordSpend(amount: AtomicUsdc): Promise<void> {
    this.#rollIfNewDay();
    this.#spent = atomicUsdc(this.#spent + amount);
  }

  #today(): string {
    return this.#now().toISOString().slice(0, 10);
  }

  #rollIfNewDay(): void {
    const today = this.#today();
    if (today !== this.#date) {
      this.#date = today;
      this.#spent = atomicUsdc(0n);
    }
  }
}

/** No-op tracker used when no `dailyBudget` is configured. */
export class UnlimitedBudgetTracker implements BudgetTracker {
  readonly #now: () => Date;

  constructor(now: () => Date = () => new Date()) {
    this.#now = now;
  }

  async getState(): Promise<CrawlerBudgetState> {
    return {
      date: this.#now().toISOString().slice(0, 10),
      spentAtomic: atomicUsdc(0n),
      remainingAtomic: atomicUsdc(2n ** 256n - 1n),
    };
  }

  async canSpend(_amount: AtomicUsdc): Promise<boolean> {
    return true;
  }

  async recordSpend(_amount: AtomicUsdc): Promise<void> {
    // intentionally empty
  }
}
