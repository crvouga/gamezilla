import { describe, expect, test } from 'bun:test';

import {
  armCrashAt,
  asymmetricLink,
  crash,
  disconnect,
  domain,
  hold,
  invariantViolations,
  restart,
} from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';

const op = (clientId: string, command: 'increment' | 'decrement') =>
  ({ kind: 'domain', clientId, command, args: {} }) as const;

describe('room system PBT', () => {
  test(
    'explore room actions under registered properties',
    async () => {
      const report = await counterSystem.explore({
        episodes: 4,
        steps: 10,
        seed: 1,
        stopOnViolation: true,
        time: { weight: 1, minMs: 1, maxMs: 40 },
      });
      expect(report.ok).toBe(true);
    },
    { timeout: 180_000 }
  );

  test('hold then increment then heal converges (pin)', async () => {
    await using s = await counterSystem.script({
      seed: 42,
      args: { clientCount: 2 },
    });
    await s.apply(hold, 'c1');
    await s.apply(domain, op('c0', 'increment'));
    await s.elapse(20);
    await expectConverged(s);
  });

  test('crash then restart with pending offline queue converges (pin)', async () => {
    await using s = await counterSystem.script({
      seed: 99,
      args: { clientCount: 2 },
    });
    await s.apply(disconnect, 'c0');
    await s.apply(domain, op('c0', 'increment'));
    await s.apply(crash, 'c0');
    await s.apply(domain, op('c1', 'increment'));
    await s.apply(restart, 'c0');
    await expectConverged(s);
  });

  test('armCrashAt afterNextCommitted then settle (pin seed=706975)', async () => {
    await using s = await counterSystem.script({
      seed: 706975,
      args: { clientCount: 2 },
    });
    await s.apply(armCrashAt, {
      clientId: 'c1',
      event: 'afterNextCommitted' as const,
    });
    await s.apply(domain, op('c0', 'decrement'));
    await s.apply(restart, 'c1');
    await s.apply(domain, op('c1', 'decrement'));
    await s.apply(asymmetricLink, 'c0');
    await expectConverged(s);
  });

  test('ghost durable queue: dispatch then settle leaves queues empty (pin)', async () => {
    await using s = await counterSystem.script({
      seed: 4242,
      args: { clientCount: 2 },
    });
    await s.apply(domain, op('c0', 'increment'));
    await s.apply(domain, op('c1', 'increment'));
    await s.elapse(40);
    await expectConverged(s);
    expect(await s.observe(invariantViolations)).toEqual([]);
  });
});
