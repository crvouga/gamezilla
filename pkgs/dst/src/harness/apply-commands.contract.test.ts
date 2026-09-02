import { describe, expect, test } from 'bun:test';
import { createVirtualClock } from '../kernel/clock';
import { createScheduler } from '../kernel/scheduler';
import { applyActions } from './apply-actions';

describe('runUntil / applyActions', () => {
  test('runUntil returns immediately when predicate already true', async () => {
    const clock = createVirtualClock(10);
    const scheduler = createScheduler(clock);
    expect(await scheduler.runUntil(() => true)).toBe(true);
    expect(clock.now()).toBe(10);
  });

  test('runUntil advances via scheduler until predicate holds', async () => {
    const clock = createVirtualClock(0);
    const scheduler = createScheduler(clock);
    let ready = false;
    scheduler.scheduleAt(50, () => {
      ready = true;
    });
    const ok = await scheduler.runUntil(() => ready, { maxVirtualMs: 200 });
    expect(ok).toBe(true);
    expect(clock.now()).toBeGreaterThanOrEqual(50);
  });

  test('runUntil timeout returns false under budget', async () => {
    const clock = createVirtualClock(0);
    const scheduler = createScheduler(clock);
    const ok = await scheduler.runUntil(() => false, { maxVirtualMs: 50 });
    expect(ok).toBe(false);
  });

  test('predicate stays false within window', async () => {
    const clock = createVirtualClock(0);
    const scheduler = createScheduler(clock);
    scheduler.scheduleAt(50, () => {
      /* noop */
    });
    const ok = await scheduler.runUntil(() => false, { maxVirtualMs: 50 });
    expect(ok).toBe(false);
    expect(clock.now()).toBeGreaterThanOrEqual(50);
  });

  test('applyActions applies in order then advances', async () => {
    const clock = createVirtualClock(0);
    const scheduler = createScheduler(clock);
    const seen: string[] = [];
    await applyActions({
      advance: (ms) => scheduler.runFor(ms),
      actions: [{ kind: 'a' }, { kind: 'b' }],
      apply: async (c) => {
        seen.push(c.kind);
      },
    });
    expect(seen).toEqual(['a', 'b']);
    expect(clock.now()).toBeGreaterThanOrEqual(20);
  });
});
