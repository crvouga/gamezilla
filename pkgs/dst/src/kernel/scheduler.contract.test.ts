import { describe, expect, test } from 'bun:test';
import { createVirtualClock } from './clock';
import { createRngInternal } from './rng';
import { createScheduler } from './scheduler';
import { createVirtualScheduler } from './scheduler-api';
import { createTimers } from './timers';
import { createTraceRecorder } from './trace';

describe('Scheduler contract', () => {
  test('same-at tasks fire in insertion order without choiceRng', async () => {
    const clock = createVirtualClock(0);
    const sched = createScheduler(clock);
    const order: number[] = [];
    sched.scheduleAt(10, () => {
      order.push(1);
    });
    sched.scheduleAt(10, () => {
      order.push(2);
    });
    sched.scheduleAt(10, () => {
      order.push(3);
    });
    await sched.runFor(10);
    expect(order).toEqual([1, 2, 3]);
    expect(clock.now()).toBe(10);
  });

  test('cross-task promise does not hang (quiescence probe)', async () => {
    const clock = createVirtualClock(0);
    const sched = createScheduler(clock);
    let resolveB!: () => void;
    const bReady = new Promise<void>((r) => {
      resolveB = r;
    });
    let aDone = false;
    sched.scheduleAt(0, async () => {
      await bReady;
      aDone = true;
    });
    sched.scheduleAt(0, () => {
      resolveB();
    });
    await sched.runUntilQuiescent();
    expect(aDone).toBe(true);
  });

  test('runUntil does not advance clock while wall I/O still pending', async () => {
    const clock = createVirtualClock(0);
    const sched = createScheduler(clock);
    let scheduledAt = -1;
    let done = false;
    sched.scheduleAt(0, async () => {
      // Two macrotask hops before scheduleAfter — quiescence wins first.
      await new Promise<void>((r) => {
        setImmediate(r);
      });
      await new Promise<void>((r) => {
        setImmediate(r);
      });
      sched.scheduleAfter(5_000, () => {});
      scheduledAt = clock.now();
      done = true;
    });
    sched.scheduleAt(100, () => {});
    const ok = await sched.runUntil(() => done, { maxVirtualMs: 10_000 });
    expect(ok).toBe(true);
    expect(scheduledAt).toBe(0);
  });

  test('seeded same-at choice is deterministic per seed', async () => {
    const run = async (seed: number) => {
      const clock = createVirtualClock(0);
      const rng = createRngInternal(seed);
      const trace = createTraceRecorder();
      const ports = createVirtualScheduler({
        clock,
        choiceRng: rng._seeded.fork('sched'),
        trace,
      });
      const order: number[] = [];
      for (let i = 0; i < 5; i += 1) {
        const n = i;
        ports.underlying.scheduleAt(0, () => {
          order.push(n);
        });
      }
      await ports.underlying.runFor(0);
      return order;
    };
    expect(await run(7)).toEqual(await run(7));
    const a = await run(11);
    const b = await run(11);
    expect(a).toEqual(b);
  });

  test('scheduleAt past at>=0 is immediately due', async () => {
    const clock = createVirtualClock(100);
    const sched = createScheduler(clock);
    let fired = false;
    sched.scheduleAt(50, () => {
      fired = true;
    });
    await sched.runFor(0);
    expect(fired).toBe(true);
  });

  test('scheduleAt at<0 throws', () => {
    const sched = createScheduler(createVirtualClock(0));
    expect(() => sched.scheduleAt(-1, () => {})).toThrow(/bad at/);
  });

  test('scheduleAfter negatives clamp to 0', async () => {
    const clock = createVirtualClock(5);
    const sched = createScheduler(clock);
    let fired = false;
    sched.scheduleAfter(-10, () => {
      fired = true;
    });
    await sched.runFor(0);
    expect(fired).toBe(true);
  });

  test('runFor endpoint includes tasks at end, excludes after', async () => {
    const clock = createVirtualClock(0);
    const sched = createScheduler(clock);
    const order: string[] = [];
    sched.scheduleAt(10, () => {
      order.push('at10');
    });
    sched.scheduleAt(11, () => {
      order.push('at11');
    });
    await sched.runFor(10);
    expect(order).toEqual(['at10']);
    expect(clock.now()).toBe(10);
  });

  test('nested drain throws unified message', async () => {
    const clock = createVirtualClock(0);
    const sched = createScheduler(clock);
    sched.scheduleAt(0, async () => {
      await expect(sched.runFor(1)).rejects.toThrow(/nested drain/);
    });
    await sched.runFor(0);
  });

  test('task scheduled at now during fire runs in same round', async () => {
    const clock = createVirtualClock(0);
    const sched = createScheduler(clock);
    const order: number[] = [];
    sched.scheduleAt(0, () => {
      order.push(1);
      sched.scheduleAt(0, () => {
        order.push(2);
      });
    });
    await sched.runFor(0);
    expect(order).toEqual([1, 2]);
  });

  test('timer cancel prevents fire', async () => {
    const clock = createVirtualClock(0);
    const sched = createScheduler(clock);
    const timers = createTimers(sched);
    let n = 0;
    const h = timers.setTimeout(() => {
      n += 1;
    }, 5);
    timers.clearTimeout(h);
    await sched.runFor(10);
    expect(n).toBe(0);
  });

  test('dual-run identical timeline', async () => {
    const run = async () => {
      const clock = createVirtualClock(0);
      const sched = createScheduler(clock);
      const hits: number[] = [];
      sched.scheduleAt(3, () => {
        hits.push(clock.now());
      });
      sched.scheduleAt(7, () => {
        hits.push(clock.now());
      });
      await sched.runFor(10);
      return hits;
    };
    expect(await run()).toEqual(await run());
  });
});

describe('rng fork isolation', () => {
  test('extra createId-scope fork does not change network draws', () => {
    const a = createRngInternal(42);
    const b = createRngInternal(42);
    const netA = a.fork('net');
    const netB = b.fork('net');
    a.fork('id').next();
    a.fork('id').next();
    expect(netA.next()).toBe(netB.next());
  });

  test('extra network draws do not change id fork', () => {
    const a = createRngInternal(99);
    const b = createRngInternal(99);
    a.fork('net').next();
    a.fork('net').next();
    expect(a.fork('id').next()).toBe(b.fork('id').next());
  });
});
