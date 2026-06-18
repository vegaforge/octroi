import { describe, expect, it } from 'vitest';
import { atomicUsdc } from '@octroi/types';
import { InMemoryBudgetTracker, UnlimitedBudgetTracker } from '../budget';

describe('InMemoryBudgetTracker', () => {
  it('reports zero spend at start and full remaining budget', async () => {
    const t = new InMemoryBudgetTracker(atomicUsdc(1_000_000n));
    const state = await t.getState();
    expect(state.spentAtomic).toBe(0n);
    expect(state.remainingAtomic).toBe(1_000_000n);
  });

  it('canSpend returns true while within budget and false past it', async () => {
    const t = new InMemoryBudgetTracker(atomicUsdc(1000n));
    expect(await t.canSpend(atomicUsdc(500n))).toBe(true);
    await t.recordSpend(atomicUsdc(500n));
    expect(await t.canSpend(atomicUsdc(500n))).toBe(true);
    await t.recordSpend(atomicUsdc(500n));
    expect(await t.canSpend(atomicUsdc(1n))).toBe(false);
  });

  it('tracks recordSpend cumulatively', async () => {
    const t = new InMemoryBudgetTracker(atomicUsdc(10_000n));
    await t.recordSpend(atomicUsdc(1000n));
    await t.recordSpend(atomicUsdc(2500n));
    const state = await t.getState();
    expect(state.spentAtomic).toBe(3500n);
    expect(state.remainingAtomic).toBe(6500n);
  });

  it('resets when the UTC day rolls over', async () => {
    const dates = [
      new Date('2026-04-25T10:00:00Z'),
      new Date('2026-04-25T23:59:00Z'),
      new Date('2026-04-26T00:01:00Z'),
    ];
    let i = 0;
    const t = new InMemoryBudgetTracker(atomicUsdc(1000n), () => dates[i]!);
    await t.recordSpend(atomicUsdc(800n));
    i = 1;
    expect((await t.getState()).spentAtomic).toBe(800n);
    i = 2;
    const state = await t.getState();
    expect(state.spentAtomic).toBe(0n);
    expect(state.date).toBe('2026-04-26');
  });
});

describe('UnlimitedBudgetTracker', () => {
  it('always reports canSpend true and never accumulates spend', async () => {
    const t = new UnlimitedBudgetTracker();
    expect(await t.canSpend(atomicUsdc(10n ** 18n))).toBe(true);
    await t.recordSpend(atomicUsdc(10n ** 18n));
    expect((await t.getState()).spentAtomic).toBe(0n);
  });
});
