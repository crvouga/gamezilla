import { describe, expect, test } from 'bun:test';

import { createSimClock } from '../../sim/clock';
import { createSeededRng } from '../../sim/rng';
import { createSimScheduler } from '../../sim/scheduler';
import { createSimTimers } from '../../sim/timers';

describe('sim kernel', () => {
  test('rng same seed identical stream', () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    const seqA = Array.from({ length: 20 }, () => a.random());
    const seqB = Array.from({ length: 20 }, () => b.random());
    expect(seqA).toEqual(seqB);
  });

  test('rng different seeds diverge', () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);
    expect(a.random()).not.toBe(b.random());
  });

  test('fork is deterministic and independent', () => {
    const root = createSeededRng(99);
    const f1 = root.fork('net');
    const f2 = root.fork('net');
    expect(f1.random()).toBe(f2.random());
    const work = root.fork('work');
    expect(work.random()).not.toBe(f1.random());
  });

  test('scheduler fires in time then insertion order', async () => {
    const clock = createSimClock(0);
    const sched = createSimScheduler(clock);
    const order: string[] = [];
    sched.scheduleAt(10, () => {
      order.push('a');
    });
    sched.scheduleAt(10, () => {
      order.push('b');
    });
    sched.scheduleAt(5, () => {
      order.push('c');
    });
    await sched.runFor(10);
    expect(order).toEqual(['c', 'a', 'b']);
    expect(clock.now()).toBe(10);
  });

  test('sim timers drive via scheduler', async () => {
    const clock = createSimClock(0);
    const sched = createSimScheduler(clock);
    const timers = createSimTimers(sched);
    let fired = 0;
    timers.setTimeout(() => {
      fired += 1;
    }, 50);
    const h = timers.setTimeout(() => {
      fired += 10;
    }, 100);
    timers.clearTimeout(h);
    await sched.runFor(200);
    expect(fired).toBe(1);
    expect(clock.now()).toBe(200);
  });

  test('runUntilIdle drains nested schedules', async () => {
    const clock = createSimClock(0);
    const sched = createSimScheduler(clock);
    let n = 0;
    const chain = (): void => {
      n += 1;
      if (n < 5) sched.scheduleAfter(1, chain);
    };
    sched.scheduleAfter(0, chain);
    await sched.runUntilIdle();
    expect(n).toBe(5);
    expect(sched.pendingCount()).toBe(0);
  });
});
