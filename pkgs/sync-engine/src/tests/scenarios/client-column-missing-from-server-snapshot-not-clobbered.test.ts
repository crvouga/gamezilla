import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';
import {
  expectLiveNote,
  notesDomainPack,
  notesLocalSchemaExtraColumn,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('client column missing from server snapshot not clobbered', () => {
  for (const seed of [740, 741, 742]) {
    test(`local color survives peer body update (seed=${seed})`, async () => {
      // Server stays on base schema (no color). Client has extra column.
      const world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        faults: RELIABLE_FAULTS,
      });
      try {
        const a = await world.addClient({
          id: 'alice',
          localSchema: notesLocalSchemaExtraColumn,
        });
        const b = await world.addClient({ id: 'bob' });

        await a.mutate(setNote, { id: 'n1', body: 'v1' });
        await world.assertConverged();

        // Domain-only local write — not uploaded (server has no color column).
        await a.db.run(sql`
          UPDATE notes SET color = ${'red'} WHERE id = ${'n1'}
        `);
        const before = await a.db.query(sql<{ color: string | null }>`
          SELECT color FROM notes WHERE id = ${'n1'} AND _deleted_at IS NULL
        `);
        expect(before[0]?.color).toBe('red');

        await b.mutate(setNote, { id: 'n1', body: 'from-bob' });
        await world.assertConverged();

        await expectLiveNote(a.db, 'n1', { body: 'from-bob' });
        const after = await a.db.query(sql<{ color: string | null }>`
          SELECT color FROM notes WHERE id = ${'n1'} AND _deleted_at IS NULL
        `);
        expect(after[0]?.color).toBe('red');
      } finally {
        await world.dispose();
      }
    });
  }
});
