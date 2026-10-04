import { describe, expect, test } from 'bun:test';
import { createSeededRng } from '@pkgs/uuid-shared/seeded-rng';
import { createVirtualClock } from '@pkgs/harness-shared/clock';
import { createScheduler } from '@pkgs/harness-shared/scheduler';
import { createTraceRecorder } from '@pkgs/harness-shared/trace';
import { createNetwork } from '@pkgs/harness-shared/network';
import { RELIABLE_NETWORK } from '@pkgs/harness-shared/network-state';

describe('Network contract', () => {
  test('local send delivers without RNG', async () => {
    const clock = createVirtualClock(0);
    const scheduler = createScheduler(clock);
    const network = createNetwork({
      scheduler,
      rng: createSeededRng(1),
      faults: RELIABLE_NETWORK,
    });
    const got: unknown[] = [];
    network.register('a', (p) => {
      got.push(p);
    });
    network.send('a', 'a', { x: 1 });
    await scheduler.runFor(0);
    expect(got).toEqual([{ x: 1 }]);
  });

  test('persistent partition drops; heal restores', async () => {
    const clock = createVirtualClock(0);
    const scheduler = createScheduler(clock);
    const network = createNetwork({
      scheduler,
      rng: createSeededRng(1),
    });
    const got: unknown[] = [];
    network.register('a', () => {});
    network.register('b', (p) => {
      got.push(p);
    });
    network.partition('a', 'b');
    network.send('a', 'b', 1);
    await scheduler.runFor(0);
    expect(got).toEqual([]);
    network.heal('a', 'b');
    network.send('a', 'b', 2);
    await scheduler.runFor(0);
    expect(got).toEqual([2]);
  });

  test('spontaneous heal is reachable (heal-before-drop)', async () => {
    const clock = createVirtualClock(0);
    const scheduler = createScheduler(clock);
    const network = createNetwork({
      scheduler,
      rng: createSeededRng(7),
      faults: {
        ...RELIABLE_NETWORK,
        healProbability: 1,
      },
    });
    const got: unknown[] = [];
    network.register('a', () => {});
    network.register('b', (p) => {
      got.push(p);
    });
    network.partition('a', 'b');
    network.send('a', 'b', 'healed');
    await scheduler.runFor(0);
    expect(got).toEqual(['healed']);
    expect(network.isPartitioned('a', 'b')).toBe(false);
  });

  test('hold/release FIFO without re-faulting', async () => {
    const clock = createVirtualClock(0);
    const scheduler = createScheduler(clock);
    const network = createNetwork({
      scheduler,
      rng: createSeededRng(1),
      faults: {
        ...RELIABLE_NETWORK,
        dropProbability: 1,
      },
    });
    const got: unknown[] = [];
    network.register('a', () => {});
    network.register('b', (p) => {
      got.push(p);
    });
    network.hold('k1');
    network.send('a', 'b', 1, { key: 'k1' });
    network.send('a', 'b', 2, { key: 'k1' });
    await scheduler.runFor(0);
    expect(got).toEqual([]);
    network.release('k1');
    await scheduler.runFor(0);
    expect(got).toEqual([1, 2]);
  });

  test('overlay faults + defensive copies', () => {
    const clock = createVirtualClock(0);
    const scheduler = createScheduler(clock);
    const network = createNetwork({
      scheduler,
      rng: createSeededRng(1),
    });
    network.setFaults({
      ...RELIABLE_NETWORK,
      dropProbability: 0.5,
    });
    network.setFaults({ dropProbability: 0.1 }, 'k');
    const eff = network.faults('k');
    expect(eff.dropProbability).toBe(0.1);
    (eff as { dropProbability: number }).dropProbability = 0.9;
    expect(network.faults('k').dropProbability).toBe(0.1);
  });

  test('invalid faults throw', () => {
    const clock = createVirtualClock(0);
    const scheduler = createScheduler(clock);
    const network = createNetwork({
      scheduler,
      rng: createSeededRng(1),
    });
    expect(() =>
      network.setFaults({
        ...RELIABLE_NETWORK,
        dropProbability: 2,
      })
    ).toThrow(/invalid/);
  });

  test('RNG golden: drop then deliver sequence', async () => {
    const run = async (seed: number) => {
      const clock = createVirtualClock(0);
      const scheduler = createScheduler(clock);
      const trace = createTraceRecorder();
      const network = createNetwork({
        scheduler,
        rng: createSeededRng(seed).fork('net'),
        faults: {
          ...RELIABLE_NETWORK,
          dropProbability: 0.5,
        },
        trace,
      });
      const got: unknown[] = [];
      network.register('a', () => {});
      network.register('b', (p) => {
        got.push(p);
      });
      for (let i = 0; i < 8; i += 1) {
        network.send('a', 'b', i, { key: 'lane' });
      }
      await scheduler.runFor(0);
      return {
        got,
        records: trace.records().map((e) => e.type),
      };
    };
    const a = await run(12345);
    const b = await run(12345);
    expect(a).toEqual(b);
  });

  test('inFlight excludes held and settles to zero on drops', async () => {
    const clock = createVirtualClock(0);
    const scheduler = createScheduler(clock);
    const network = createNetwork({
      scheduler,
      rng: createSeededRng(1),
    });
    network.register('a', () => {});
    network.register('b', () => {});
    expect(network.inFlight()).toBe(0);

    network.hold('k');
    network.send('a', 'b', 1, { key: 'k' });
    expect(network.inFlight()).toBe(0);
    network.release('k');
    expect(network.inFlight()).toBe(1);
    await scheduler.runFor(0);
    expect(network.inFlight()).toBe(0);

    network.send('a', 'b', 2);
    network.partition('a', 'b');
    await scheduler.runFor(0);
    expect(network.inFlight()).toBe(0);

    network.heal('a', 'b');
    network.send('a', 'b', 3);
    network.unregister('b');
    await scheduler.runFor(0);
    expect(network.inFlight()).toBe(0);
  });

  test('duplicate reuses messageId', async () => {
    const clock = createVirtualClock(0);
    const scheduler = createScheduler(clock);
    const trace = createTraceRecorder();
    const network = createNetwork({
      scheduler,
      rng: createSeededRng(1),
      faults: {
        ...RELIABLE_NETWORK,
        duplicateProbability: 1,
      },
      trace,
    });
    network.register('a', () => {});
    network.register('b', () => {});
    network.send('a', 'b', 'x');
    await scheduler.runFor(0);
    const sends = trace
      .records()
      .filter((e) => e.type === 'network' && e.op === 'send');
    const delivers = trace
      .records()
      .filter((e) => e.type === 'network' && e.op === 'deliver');
    expect(sends).toHaveLength(1);
    expect(delivers).toHaveLength(2);
    expect(delivers[0]).toMatchObject({ detail: 0 });
    expect(delivers[1]).toMatchObject({ detail: 0 });
  });
});
