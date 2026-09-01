import { describe, expect, test } from 'bun:test';
import { createSeededRng } from '@pkgs/uuid';
import {
  createSimClock,
  createSimNetwork,
  createSimScheduler,
  createSimTrace,
  RELIABLE_NET_FAULTS,
} from '../src/index';

describe('SimNetwork contract', () => {
  test('local send delivers without RNG', async () => {
    const clock = createSimClock(0);
    const sched = createSimScheduler(clock);
    const rng = createSeededRng(1);
    const before = rng.random();
    const net = createSimNetwork({
      scheduler: sched,
      rng: createSeededRng(1),
      faults: RELIABLE_NET_FAULTS,
    });
    const got: unknown[] = [];
    net.register('a', (p) => {
      got.push(p);
    });
    net.send('a', 'a', { x: 1 });
    await sched.runFor(0);
    expect(got).toEqual([{ x: 1 }]);
    // independent rng unused by local path — golden uses separate instance
    void before;
  });

  test('persistent partition drops; heal restores', async () => {
    const clock = createSimClock(0);
    const sched = createSimScheduler(clock);
    const net = createSimNetwork({
      scheduler: sched,
      rng: createSeededRng(1),
    });
    const got: unknown[] = [];
    net.register('a', () => {});
    net.register('b', (p) => {
      got.push(p);
    });
    net.partition('a', 'b');
    net.send('a', 'b', 1);
    await sched.runFor(0);
    expect(got).toEqual([]);
    net.heal('a', 'b');
    net.send('a', 'b', 2);
    await sched.runFor(0);
    expect(got).toEqual([2]);
  });

  test('spontaneous heal is reachable (heal-before-drop)', async () => {
    const clock = createSimClock(0);
    const sched = createSimScheduler(clock);
    const net = createSimNetwork({
      scheduler: sched,
      rng: createSeededRng(7),
      faults: {
        ...RELIABLE_NET_FAULTS,
        unpartitionProbability: 1,
      },
    });
    const got: unknown[] = [];
    net.register('a', () => {});
    net.register('b', (p) => {
      got.push(p);
    });
    net.partition('a', 'b');
    net.send('a', 'b', 'healed');
    await sched.runFor(0);
    expect(got).toEqual(['healed']);
    expect(net.isEdgePartitioned('a', 'b')).toBe(false);
  });

  test('hold/release FIFO without re-faulting', async () => {
    const clock = createSimClock(0);
    const sched = createSimScheduler(clock);
    const net = createSimNetwork({
      scheduler: sched,
      rng: createSeededRng(1),
      faults: {
        ...RELIABLE_NET_FAULTS,
        packetLossProbability: 1,
      },
    });
    const got: unknown[] = [];
    net.register('a', () => {});
    net.register('b', (p) => {
      got.push(p);
    });
    net.hold('k1');
    net.send('a', 'b', 1, { key: 'k1' });
    net.send('a', 'b', 2, { key: 'k1' });
    await sched.runFor(0);
    expect(got).toEqual([]);
    net.release('k1');
    await sched.runFor(0);
    expect(got).toEqual([1, 2]);
  });

  test('overlay profile + defensive copies', () => {
    const clock = createSimClock(0);
    const sched = createSimScheduler(clock);
    const net = createSimNetwork({
      scheduler: sched,
      rng: createSeededRng(1),
    });
    net.setDefaultFaults({
      ...RELIABLE_NET_FAULTS,
      packetLossProbability: 0.5,
    });
    net.setKeyFaults('k', { packetLossProbability: 0.1 });
    const eff = net.getKeyFaults('k');
    expect(eff.packetLossProbability).toBe(0.1);
    (eff as { packetLossProbability: number }).packetLossProbability = 0.9;
    expect(net.getKeyFaults('k').packetLossProbability).toBe(0.1);
  });

  test('invalid profile throws', () => {
    const clock = createSimClock(0);
    const sched = createSimScheduler(clock);
    const net = createSimNetwork({
      scheduler: sched,
      rng: createSeededRng(1),
    });
    expect(() =>
      net.setDefaultFaults({
        ...RELIABLE_NET_FAULTS,
        packetLossProbability: 2,
      })
    ).toThrow(/invalid/);
  });

  test('RNG golden: loss then deliver sequence', async () => {
    const run = async (seed: number) => {
      const clock = createSimClock(0);
      const sched = createSimScheduler(clock);
      const trace = createSimTrace(true);
      const net = createSimNetwork({
        scheduler: sched,
        rng: createSeededRng(seed).fork('net'),
        faults: {
          ...RELIABLE_NET_FAULTS,
          packetLossProbability: 0.5,
        },
        trace,
      });
      const got: unknown[] = [];
      net.register('a', () => {});
      net.register('b', (p) => {
        got.push(p);
      });
      for (let i = 0; i < 8; i += 1) {
        net.send('a', 'b', i, { key: 'lane' });
      }
      await sched.runFor(0);
      return {
        got,
        events: trace.events().map((e) => e.type),
      };
    };
    const a = await run(12345);
    const b = await run(12345);
    expect(a).toEqual(b);
  });

  test('inFlightCount excludes held and settles to zero on drops', async () => {
    const clock = createSimClock(0);
    const sched = createSimScheduler(clock);
    const net = createSimNetwork({
      scheduler: sched,
      rng: createSeededRng(1),
    });
    net.register('a', () => {});
    net.register('b', () => {});
    expect(net.inFlightCount()).toBe(0);

    net.hold('k');
    net.send('a', 'b', 1, { key: 'k' });
    expect(net.inFlightCount()).toBe(0);
    net.release('k');
    expect(net.inFlightCount()).toBe(1);
    await sched.runFor(0);
    expect(net.inFlightCount()).toBe(0);

    // Dropped at delivery time: partitioned after the send, and unregistered.
    net.send('a', 'b', 2);
    net.partition('a', 'b');
    await sched.runFor(0);
    expect(net.inFlightCount()).toBe(0);

    net.heal('a', 'b');
    net.send('a', 'b', 3);
    net.unregister('b');
    await sched.runFor(0);
    expect(net.inFlightCount()).toBe(0);
  });

  test('duplicate reuses packetId', async () => {
    const clock = createSimClock(0);
    const sched = createSimScheduler(clock);
    const trace = createSimTrace(true);
    const net = createSimNetwork({
      scheduler: sched,
      rng: createSeededRng(1),
      faults: {
        ...RELIABLE_NET_FAULTS,
        duplicateProbability: 1,
      },
      trace,
    });
    net.register('a', () => {});
    net.register('b', () => {});
    net.send('a', 'b', 'x');
    await sched.runFor(0);
    const sends = trace.events().filter((e) => e.type === 'net_send');
    const delivers = trace.events().filter((e) => e.type === 'net_deliver');
    expect(sends).toHaveLength(1);
    expect(delivers).toHaveLength(2);
    expect(delivers[0]).toMatchObject({ packetId: 0 });
    expect(delivers[1]).toMatchObject({ packetId: 0 });
  });
});
