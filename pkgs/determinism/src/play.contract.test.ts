import { describe, expect, test } from 'bun:test';
import {
  createSimClock,
  createSimScheduler,
  isSimPollable,
  never,
  playActionsOnWorld,
  type SimPlayHost,
  until,
} from '../src/index';

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

  test('isSimPollable detects brand', () => {
    const p = Object.assign(Promise.resolve(1), {
      __simPoll: async () => true,
    });
    expect(isSimPollable(p)).toBe(true);
    expect(isSimPollable(Promise.resolve(1))).toBe(false);
  });

  test('playActionsOnWorld order + invariant seed', async () => {
    const clock = createSimClock(0);
    const scheduler = createSimScheduler(clock);
    const seen: number[] = [];
    const host: SimPlayHost = {
      seed: 0x42n,
      runFor: (ms) => scheduler.runFor(ms),
      checkInvariants: async () =>
        seen.length > 1 ? { invariant: 'too-many', detail: 'boom' } : null,
    };
    await expect(
      playActionsOnWorld({
        host,
        actions: [{ n: 1 }, { n: 2 }],
        dispatch: async (a) => {
          seen.push(a.n);
        },
      })
    ).rejects.toThrow(/too-many seed=42/);
    expect(seen).toEqual([1, 2]);
  });
});
