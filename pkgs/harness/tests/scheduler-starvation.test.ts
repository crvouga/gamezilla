import { describe, expect, test } from 'bun:test';
import { virtualTimeRuntime } from '@pkgs/harness';
import { createScheduler, createVirtualClock } from '@pkgs/harness/internals';

/**
 * A wait must measure simulated progress, not the host's spare capacity.
 *
 * The drain gives a starved process a bounded number of macrotask turns before
 * it moves virtual time anyway. When that guess is wrong the clock runs ahead
 * of the work, and a scenario that would have converged fails on its deadline
 * instead — which is how `chess-puzzle-spectator` failed on CI and passed on
 * an idle laptop. `until` / `pollUntil` read this counter so a poll spent that
 * way does not spend their budget.
 */
describe('starved advances are visible to waiters', () => {
  // regression: scheduler-overdue-task-rewind
  test('an overdue task arriving while sleep drains fires without rewinding time', async () => {
    const start = 1718409935000;
    const clock = createVirtualClock(start);
    const scheduler = createScheduler(clock);
    const firedAt: number[] = [];
    const sleeping = scheduler.sleep(3_600_000);
    queueMicrotask(() => {
      scheduler.scheduleAt(1718409601001, () => {
        firedAt.push(clock.now());
      });
    });
    await sleeping;
    expect(firedAt).toEqual([start]);
    expect(clock.now()).toBe(start + 3_600_000);
    expect(scheduler.pendingTaskCount()).toBe(0);
  });

  test('a quiet simulation never reports a starved advance', async () => {
    const session = await virtualTimeRuntime().open(1);
    try {
      await session.advanceTime(1_000);
      expect(session.scheduler.starvedAdvances()).toBe(0);
    } finally {
      await session.dispose();
    }
  });

  test('the count is monotonic across advances', async () => {
    const session = await virtualTimeRuntime().open(1);
    try {
      const before = session.scheduler.starvedAdvances();
      await session.advanceTime(50);
      const after = session.scheduler.starvedAdvances();
      expect(after).toBeGreaterThanOrEqual(before);
    } finally {
      await session.dispose();
    }
  });

  test('a wall-clock session reports none by construction', async () => {
    // Wall time cannot run ahead of the work it waits for.
    const session = await virtualTimeRuntime().open(2);
    try {
      expect(session.scheduler.starvedAdvances()).toBe(0);
    } finally {
      await session.dispose();
    }
  });
});
