import { describe, expect, test } from 'bun:test';

import { domain, takeOver } from '../../sim/scenario';
import { authzSystem } from '../apps/authz/system';
import { expectConverged } from '../expect-converged';
import { authzCount, authzOwner } from '../fixtures/authz-module';
import { readServer } from '../scenario/read-state';

describe('room authz-graph PBT', () => {
  test(
    'claim / bump under session churn keeps ownership stable and converges',
    async () => {
      const report = await authzSystem.explore({
        seed: 17,
        episodes: 8,
        steps: 16,
        actions: [
          'domain',
          'disconnect',
          'connect',
          'takeOver',
          'hold',
          'release',
          'heal',
        ],
        time: { weight: 1, minMs: 1, maxMs: 40 },
      });
      expect(report.ok).toBe(true);
      expect(report.coverage.actions['domain'] ?? 0).toBeGreaterThan(0);
    },
    { timeout: 120_000 }
  );

  test('owner claim+bump; non-owner bump never mutates (pin)', async () => {
    await using s = await authzSystem.script({
      seed: 21,
      args: { clientCount: 2 },
    });
    await s.apply(domain, {
      kind: 'domain',
      clientId: 'c0',
      command: 'claim',
      args: {},
    });
    await s.elapse(10);
    await s.apply(domain, {
      kind: 'domain',
      clientId: 'c1',
      command: 'bump',
      args: {},
    });
    await s.apply(domain, {
      kind: 'domain',
      clientId: 'c0',
      command: 'bump',
      args: {},
    });
    await s.apply(takeOver, 'c1');
    await s.apply(domain, {
      kind: 'domain',
      clientId: 'c1',
      command: 'bump',
      args: {},
    });
    await expectConverged(s);
    const snap = await readServer(s);
    expect(authzOwner(snap)).toBe('c0');
    expect(authzCount(snap)).toBe(1);
  });
});
