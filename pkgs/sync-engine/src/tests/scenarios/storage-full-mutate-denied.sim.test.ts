import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import { sql } from '@pkgs/sql';
import {
  acmeKnobs,
  acmeSystem,
  armStoragePressure,
  expectConverged,
  lastMutationFailures,
  lastMutationOk,
  mutate,
  playActions,
  rows,
  type SyncSurface,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

async function pendingMutations(s: SyncSurface) {
  return rows(
    s,
    'pendingMutations',
    'c0',
    sql`
      SELECT COUNT(*) AS c FROM sync_engine_mutations
      WHERE deleted_at IS NULL
    `
  ) as Promise<{ readonly c: number | string }[]>;
}

describe('storage full mutate denied', () => {
  test('SQLITE_FULL returns STORAGE_FULL and does not queue', async () => {
    await using run = await script(acmeSystem, {
      seed: 55100,
      host: syncVirtualHost(),
      knobs: acmeKnobs(),
      properties: [],
    });

    await run.apply(armStoragePressure, 'c0', 'sqliteFull');
    await run.apply(mutate, 'c0', setNote, { id: 'n0', body: 'quota' });
    expect(await run.observe(lastMutationOk, 'c0')).toBe(false);
    expect(await run.observe(lastMutationFailures, 'c0')).toContain(
      'STORAGE_FULL'
    );

    const pending = await run.observe(pendingMutations);
    expect(Number(pending[0]?.c ?? 0)).toBe(0);

    await run.apply(playActions, [
      { kind: 'restart', clientId: 'c0' },
      { kind: 'heal' },
    ]);
    await expectConverged(run);
  });
});
