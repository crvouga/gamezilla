import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { sql } from '@pkgs/sql';
import {
  acmeLocalSchemaExtraColumn,
  acmeMutationRegistry,
  acmeQueryRegistry,
  expectLiveNote,
  expectNotesMatchServer,
  notesWorldWithColorQuery,
  setNote,
  setNoteColor,
} from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('server schema upgrade mid session', () => {
  test.each([2120, 2121, 2122])(
    'server adds color mid-life; old clients ignore; new client stores (seed=%i)',
    async (seed) => {
      await using host = await openWorld(acmeSystem, {
        seed: seed,
        knobs: {
          clientCount: 0,
        },
      });
      const world = host.facade;
      const alice = await world.addClient({ id: 'alice' });
      const bob = await world.addClient({ id: 'bob' });

      await alice.mutate(setNote, { id: 'n1', body: 'before-upgrade' });
      await world.assertConverged();

      await world.node('server').restart({
        preserveLocalDb: true,
        localSchema: acmeLocalSchemaExtraColumn,
        mutationRegistry: {
          ...acmeMutationRegistry,
          [setNoteColor.name]: setNoteColor,
        },
        queryRegistry: {
          ...acmeQueryRegistry,
          [notesWorldWithColorQuery.name]: notesWorldWithColorQuery,
        },
      });

      const carol = await world.addClient({
        id: 'carol',
        localSchema: acmeLocalSchemaExtraColumn,
        mutationRegistry: {
          ...acmeMutationRegistry,
          [setNoteColor.name]: setNoteColor,
        },
        queryRegistry: {
          ...acmeQueryRegistry,
          [notesWorldWithColorQuery.name]: notesWorldWithColorQuery,
        },
        sessionQuery: { name: 'notesWorldWithColor', params: {} },
      });

      await carol.mutate(setNoteColor, {
        id: 'n1',
        body: 'after-upgrade',
        color: 'green',
      });
      await alice.mutate(setNote, { id: 'n2', body: 'still-baseline' });
      await world.assertConverged();

      await expectLiveNote(alice.db, 'n1', { body: 'after-upgrade' });
      await expectLiveNote(bob.db, 'n1', { body: 'after-upgrade' });
      await expectLiveNote(carol.db, 'n1', { body: 'after-upgrade' });
      await expectLiveNote(alice.db, 'n2', { body: 'still-baseline' });
      await expectNotesMatchServer(alice.db, world.server.db);

      const aliceCols = await alice.db.query(sql<{ name: string }>`
        SELECT name FROM pragma_table_info('notes')
      `);
      expect(aliceCols.some((c) => c.name === 'color')).toBe(false);

      const carolColor = await carol.db.query(sql<{ color: string | null }>`
        SELECT color FROM notes WHERE id = ${'n1'} AND deleted_at IS NULL
      `);
      expect(carolColor[0]?.color).toBe('green');
    }
  );
});
