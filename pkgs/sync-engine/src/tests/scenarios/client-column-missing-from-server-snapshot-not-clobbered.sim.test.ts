import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { sql } from '@pkgs/sql';
import { syncFacade } from '../../sim/system';
import {
  acmeLocalSchemaExtraColumn,
  expectLiveNote,
  setNote,
} from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('client column missing from server snapshot not clobbered', () => {
  test.each([740, 741, 742])(
    'local color survives peer body update (seed=%i)',
    async (seed) => {
      // Server stays on base schema (no color). Client has extra column.
      await using host = await openWorld(acmeSystem, {
        seed: seed,
        knobs: {
          clientCount: 0,
        },
      });
      const world = syncFacade(host.system);
      const a = await world.addClient({
        id: 'alice',
        localSchema: acmeLocalSchemaExtraColumn,
      });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'n1', body: 'v1' });
      await world.assertConverged();

      // Domain-only local write — not uploaded (server has no color column).
      await a.db.run(sql`
        UPDATE notes SET color = ${'red'} WHERE id = ${'n1'}
      `);
      const before = await a.db.query(sql<{ color: string | null }>`
        SELECT color FROM notes WHERE id = ${'n1'} AND deleted_at IS NULL
      `);
      expect(before[0]?.color).toBe('red');

      await b.mutate(setNote, { id: 'n1', body: 'from-bob' });
      await world.assertConverged();

      await expectLiveNote(a.db, 'n1', { body: 'from-bob' });
      const after = await a.db.query(sql<{ color: string | null }>`
        SELECT color FROM notes WHERE id = ${'n1'} AND deleted_at IS NULL
      `);
      expect(after[0]?.color).toBe('red');
    }
  );
});
