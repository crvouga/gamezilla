import { describe, expect, test } from 'bun:test';
import { openDstWorld } from '@pkgs/dst';
import { sql } from '@pkgs/sql';
import { playSyncActions, syncFacade } from '../../sim/dst';
import { setNote } from '../apps/acme';
import { acmeDst } from '../apps/acme/dst';

describe('storage full mutate denied', () => {
  test('SQLITE_FULL returns STORAGE_FULL and does not queue', async () => {
    await using world = await openDstWorld(acmeDst, { seed: 55100 });
    const facade = syncFacade(world.system);
    const c0 = facade.clients.get('c0');
    expect(c0).toBeDefined();
    if (c0 === undefined) return;

    facade.armStoragePressure('c0', 'sqliteFull');
    const denied = await c0.mutate(setNote, { id: 'n0', body: 'quota' });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.failures.some((f) => f.code === 'STORAGE_FULL')).toBe(true);
    }

    const pending = await c0.db.query(sql<{ c: number | string }>`
      SELECT COUNT(*) AS c FROM sync_engine_mutations
    `);
    expect(Number(pending[0]?.c ?? 0)).toBe(0);

    await playSyncActions(world, [
      { kind: 'restart', clientId: 'c0' },
      { kind: 'heal' },
    ]);
    await facade.assertConverged();
  });
});
