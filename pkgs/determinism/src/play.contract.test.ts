import { describe, expect, test } from 'bun:test';
import { createSimClock } from './clock';
import { playActions } from './play';
import { createSimScheduler } from './scheduler';

describe('until / never / play', () => {
  test('until returns now when predicate already true', async () => {
    const clock = createSimClock(10);
    const scheduler = createSimScheduler(clock);
    expect(await scheduler.runUntil(() => true)).toBe(true);
    expect(clock.now()).toBe(10);
  });

  test('until advances via scheduler and returns completion time', async () => {
    const clock = createSimClock(0);
    const scheduler = createSimScheduler(clock);
    let ready = false;
    scheduler.scheduleAt(50, () => {
      ready = true;
    });
    const ok = await scheduler.runUntil(() => ready, { maxVirtualMs: 200 });
    expect(ok).toBe(true);
    expect(clock.now()).toBeGreaterThanOrEqual(50);
  });

  test('until timeout returns false under budget', async () => {
    const clock = createSimClock(0);
    const scheduler = createSimScheduler(clock);
    const ok = await scheduler.runUntil(() => false, { maxVirtualMs: 50 });
    expect(ok).toBe(false);
  });

  test('never path stays false within window', async () => {
    const clock = createSimClock(0);
    const scheduler = createSimScheduler(clock);
    scheduler.scheduleAt(50, () => {
      /* noop */
    });
    const ok = await scheduler.runUntil(() => false, { maxVirtualMs: 50 });
    expect(ok).toBe(false);
    expect(clock.now()).toBeGreaterThanOrEqual(50);
  });

  test('playActions dispatches in order then advances', async () => {
    const clock = createSimClock(0);
    const scheduler = createSimScheduler(clock);
    const seen: string[] = [];
    await playActions({
      advance: (ms) => scheduler.runFor(ms),
      actions: [{ kind: 'a' }, { kind: 'b' }],
      dispatch: async (a) => {
        seen.push(a.kind);
      },
    });
    expect(seen).toEqual(['a', 'b']);
    expect(clock.now()).toBeGreaterThanOrEqual(20);
  });
});
