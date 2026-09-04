import { describe, expect, test } from 'bun:test';

import {
  acmeSystem,
  armStoragePressure,
  expectConverged,
  lastMutationFailures,
  lastMutationOk,
  mutate,
  pool,
  setNote,
} from '../apps/acme';

const NOTE = (clientId: string, body: string) =>
  ({
    clientId,
    mutation: 'setNote',
    args: { id: 'n0', body, title: '' },
  }) as const;

describe('fault permutation PBT', () => {
  test(
    'full fault pool interleaves and converges',
    async () => {
      const report = await acmeSystem.explore({
        steps: 20,
        episodes: 6,
        seed: 44000,
        stopOnViolation: true,
        time: { weight: 1, minMs: 0, maxMs: 40 },
      });
      expect(report.ok).toBe(true);
    },
    { timeout: 180_000 }
  );
});

describe('fault permutation pins', () => {
  test('rate limit then mutate converges', async () => {
    await using s = await acmeSystem.script({ seed: 44001 });
    await s.apply(pool.armHttpFault, 'c0', {
      kind: 'rateLimited',
      route: 'mutations',
      retryAfterMs: 5,
    });
    await s.apply(pool.domain, NOTE('c0', 'perm'));
    await s.elapse(40);
    await s.apply(pool.heal);
    await expectConverged(s);
  });

  test('storage full then restart converges', async () => {
    await using s = await acmeSystem.script({ seed: 44002 });

    await s.apply(armStoragePressure, 'c0', 'sqliteFull');
    await s.apply(mutate, 'c0', setNote, { id: 'n0', body: 'quota' });
    expect(await s.observe(lastMutationOk, 'c0')).toBe(false);
    expect(await s.observe(lastMutationFailures, 'c0')).toContain(
      'STORAGE_FULL'
    );

    await s.apply(pool.restart, 'c0');
    await s.elapse(10);
    await s.apply(pool.domain, NOTE('c0', 'after-restart'));
    await s.elapse(10);
    await s.apply(pool.heal);
    await expectConverged(s);
  });

  test('freeze sync then thaw catches up', async () => {
    await using s = await acmeSystem.script({ seed: 44003 });
    await s.apply(pool.freeze, 'c0');
    await s.apply(pool.domain, {
      clientId: 'c0',
      mutation: 'setNote',
      args: { id: 'n1', body: 'frozen', title: '' },
    });
    await s.apply(pool.thaw, 'c0');
    await s.elapse(50);
    await s.apply(pool.heal);
    await expectConverged(s);
  });

  test('auth expired in flight refreshes', async () => {
    await using s = await acmeSystem.script({ seed: 44004 });
    await s.apply(pool.armHttpFault, 'c0', {
      kind: 'authExpiredInFlight',
      route: 'mutations',
    });
    await s.apply(pool.domain, NOTE('c0', 'perm'));
    await s.elapse(40);
    await s.apply(pool.heal);
    await expectConverged(s);
  });
});
