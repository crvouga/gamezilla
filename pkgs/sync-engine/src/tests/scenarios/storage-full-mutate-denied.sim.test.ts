import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import { sql } from '@pkgs/sql';
import {
  acmeDraws,
  acmeSystem,
  armStoragePressure,
  converge,
  lastMutationFailures,
  lastMutationOk,
  mutate,
  playActions,
  rows,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

const pendingMutations = rows<{ c: number | string }>(
  'pendingMutations',
  'c0',
  sql`
    SELECT COUNT(*) AS c FROM sync_engine_mutations
    WHERE deleted_at IS NULL
  `
);

describe('storage full mutate denied', () => {
  test('SQLITE_FULL returns STORAGE_FULL and does not queue', async () => {
    await using run = await start(acmeSystem, {
      seed: 55100,
      host: syncVirtualHost(),
      draws: acmeDraws(),
      properties: [],
    });

    await run.apply(armStoragePressure, 'c0', 'sqliteFull');
    await run.apply(mutate, 'c0', setNote, { id: 'n0', body: 'quota' });
    expect(await run.observe(lastMutationOk('c0'))).toBe(false);
    expect(await run.observe(lastMutationFailures('c0'))).toContain(
      'STORAGE_FULL'
    );

    const pending = await run.observe(pendingMutations);
    expect(Number(pending[0]?.c ?? 0)).toBe(0);

    await run.apply(playActions, [
      { kind: 'restart', clientId: 'c0' },
      { kind: 'heal' },
    ]);
    await run.apply(converge);
  });
});
