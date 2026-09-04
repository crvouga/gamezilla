import { describe, expect, test } from 'bun:test';

import { SCHEMA_VARIANTS } from '../../sim/scenario';
import { acmeSystem, expectConverged, pool } from '../apps/acme';
import { walkThenConverge } from '../apps/acme/walk-converge';

const NOTE_C0 = {
  clientId: 'c0',
  mutation: 'setNote',
  args: { id: 'n0', body: 'schema-drift', title: '' },
} as const;
const NOTE_C1 = {
  clientId: 'c1',
  mutation: 'setNote',
  args: { id: 'n1', body: 'schema-drift-peer', title: '' },
} as const;

describe('schema drift PBT', () => {
  test(
    'restartWithSchema then mutate converges among healthy clients (every variant)',
    async () => {
      for (const [i, variant] of SCHEMA_VARIANTS.entries()) {
        await using s = await acmeSystem.script({ seed: 600 + i });
        await s.apply(pool.restartWithSchema, 'c0', variant);
        await s.apply(pool.domain, NOTE_C0);
        await s.elapse(40);
        await s.apply(pool.heal);
        await expectConverged(s);
      }
    },
    { timeout: 120_000 }
  );

  test(
    'mixed-schema clients both mutate then converge',
    async () => {
      for (const [i, variant] of (
        ['extraColumn', 'extraTable'] as const
      ).entries()) {
        for (const rowImageFanout of [true, false]) {
          await using s = await acmeSystem.script({
            seed: 620 + i,
            args: { clientCount: 2, rowImageFanout },
          });
          await s.apply(pool.restartWithSchema, 'c0', variant);
          await s.apply(pool.domain, NOTE_C0);
          await s.apply(pool.domain, NOTE_C1);
          await s.elapse(40);
          await s.apply(pool.heal);
          await expectConverged(s);
        }
      }
    },
    { timeout: 120_000 }
  );

  test(
    'schema restarts interleaved with mutates converge on heal',
    async () => {
      let remade = 0;
      for (const seed of [641, 642, 643]) {
        const walk = await walkThenConverge({
          seed,
          actions: ['restartWithSchema', 'domain', 'auth', 'heal'],
          steps: 10,
        });
        remade += walk.coverage.actions['restartWithSchema'] ?? 0;
      }
      expect(remade).toBeGreaterThan(0);
    },
    { timeout: 120_000 }
  );

  test('extraColumn then extraTable remigrate converges (PBT shrink)', async () => {
    await using s = await acmeSystem.script({
      seed: 287086,
      args: { liveResendOnReconnect: true, bufferOutboundLive: true },
    });
    await s.apply(pool.restartWithSchema, 'c0', 'extraColumn');
    await s.elapse(10);
    await s.apply(pool.restartWithSchema, 'c0', 'extraTable');
    await s.elapse(10);
    await s.apply(pool.auth, 'c0', 'valid');
    await s.elapse(10);
    await expectConverged(s);
  });

  test('mixed extraColumn without row images converges (PBT shrink)', async () => {
    await using s = await acmeSystem.script({ seed: 1 });
    await s.apply(pool.restartWithSchema, 'c0', 'extraColumn');
    await s.apply(pool.domain, NOTE_C0);
    await s.apply(pool.domain, NOTE_C1);
    await s.elapse(40);
    await s.apply(pool.heal);
    await expectConverged(s);
  });

  test(
    'protocolCut rejects without wiping then heal converges',
    async () => {
      for (const seed of [661, 662, 663]) {
        await using s = await acmeSystem.script({ seed });
        await s.apply(pool.domain, NOTE_C0);
        await s.apply(pool.protocolCut, 'c0');
        await s.elapse(20);
        await s.apply(pool.auth, 'c0', 'valid');
        await s.apply(pool.heal);
        await expectConverged(s);
      }
    },
    { timeout: 120_000 }
  );
});
