import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { sql } from '@pkgs/sql';
import { defineSyncSystem } from '../../sim/scenario';
import {
  acmeApp,
  acmeLocalSchema,
  acmeLocalSchemaExtraColumn,
  acmeMutationRegistry,
  acmeQueryRegistry,
  deleteNote,
  expectLiveNote,
  expectNotesMatchServer,
  notesWorldWithColorQuery,
  readNoteTombstone,
  setNote,
  setNoteColor,
} from '../apps/acme';

const acmeColorTombstoneSystem = defineSyncSystem(acmeApp, {
  id: 'sync.acmeColorTombstoneSystem',
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

describe('mixed schema tombstone and pending rebase', () => {
  test.each([2110, 2111, 2112])(
    'pending setNoteColor revives peer tombstone; color kept (seed=%i)',
    async (seed) => {
      await using world = await openWorld(acmeColorTombstoneSystem, {
        seed: seed,
        knobs: {
          clientCount: 0,
        },
      });

      const alice = await world.addClient({
        id: 'alice',
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
      // Bob owns the row so peer soft-delete is authorized; baseline local schema.
      const bob = await world.addClient({
        id: 'bob',
        localSchema: acmeLocalSchema,
        sessionQuery: { name: 'notesWorld', params: {} },
      });

      await bob.mutate(setNote, { id: 'n1', body: 'seed' });
      await world.assertConverged();

      await alice.disconnect();
      await alice.mutate(setNoteColor, {
        id: 'n1',
        body: 'alice-pending',
        color: 'red',
      });
      await expectLiveNote(alice.db, 'n1', { body: 'alice-pending' });

      const del = await bob.mutate(deleteNote, { id: 'n1' });
      expect(del.ok).toBe(true);
      await world.advance(400);
      expect(await readNoteTombstone(world.server.db, 'n1')).not.toBeNull();

      await alice.connect();
      await world.assertConverged();

      // setNoteColor upsert clears deleted_at — revive wins (same as setNote).
      await expectLiveNote(alice.db, 'n1', { body: 'alice-pending' });
      await expectLiveNote(bob.db, 'n1', { body: 'alice-pending' });
      await expectLiveNote(world.server.db, 'n1', { body: 'alice-pending' });
      await expectNotesMatchServer(bob.db, world.server.db);

      const color = await alice.db.query(sql<{ color: string | null }>`
        SELECT color FROM notes WHERE id = ${'n1'} AND deleted_at IS NULL
      `);
      expect(color[0]?.color).toBe('red');

      const bobCols = await bob.db.query(sql<{ name: string }>`
        SELECT name FROM pragma_table_info('notes')
      `);
      expect(bobCols.some((c) => c.name === 'color')).toBe(false);
    }
  );
});
