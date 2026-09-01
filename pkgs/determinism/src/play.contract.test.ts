import { describe, expect, test } from 'bun:test';
import { createSimClock } from './clock';
import { playActions } from './play';
import { createSimScheduler } from './scheduler';
import { never, until } from './until';

describe('until / never / play', () => {
  test('until returns now when predicate already true', async () => {
    const clock = createSimClock(10);
    const scheduler = createSimScheduler(clock);
    const now = await until({ clock, scheduler, seed: 1n }, () => true);
    expect(now).toBe(10);
  });

  test('until advances via scheduler and returns completion time', async () => {
    const clock = createSimClock(0);
    const scheduler = createSimScheduler(clock);
    let ready = false;
    scheduler.scheduleAt(50, () => {
      ready = true;
    });
    const now = await until({ clock, scheduler, seed: 1n }, () => ready, {
      budgetMs: 200,
      stepMs: 25,
    });
    expect(now).toBeGreaterThanOrEqual(50);
  });

  test('until timeout includes seed diagnostics', async () => {
    const clock = createSimClock(0);
    const scheduler = createSimScheduler(clock);
    await expect(
      until({ clock, scheduler, seed: 0xabcn }, () => false, {
        budgetMs: 50,
        stepMs: 25,
      })
    ).rejects.toThrow(/seed=abc/);
  });

  test('never succeeds when target stays false', async () => {
    const clock = createSimClock(0);
    const scheduler = createSimScheduler(clock);
    await never({ clock, scheduler, seed: 1n }, () => false, {
      forMs: 50,
      stepMs: 25,
    });
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
