import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  expectLiveNote,
  expectNotesMatchServer,
  notesLocalSchema,
  notesLocalSchemaExtraColumn,
  notesMutationRegistry,
  notesQueryRegistry,
  notesWorldWithColorQuery,
  setNoteColor,
} from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('server snapshot with unknown column merges cleanly', () => {
  for (const seed of [730, 731, 732]) {
    test(`client without color ignores server color key (seed=${seed})`, async () => {
      const world = await openSimWorld({
        seed,
        faults: RELIABLE_FAULTS,
        localSchema: notesLocalSchemaExtraColumn,
        mutationRegistry: {
          ...notesMutationRegistry,
          [setNoteColor.name]: setNoteColor,
        },
        queryRegistry: {
          ...notesQueryRegistry,
          [notesWorldWithColorQuery.name]: notesWorldWithColorQuery,
        },
        sessionQuery: { name: 'notesWorldWithColor', params: {} },
      });
      try {
        const a = await world.addClient({
          id: 'alice',
          localSchema: notesLocalSchema,
        });
        const b = await world.addClient({
          id: 'bob',
          localSchema: notesLocalSchemaExtraColumn,
        });

        await b.mutate(setNoteColor, {
          id: 'n1',
          body: 'painted',
          color: 'blue',
        });
        await world.assertConverged();

        await expectLiveNote(a.db, 'n1', { body: 'painted' });
        await expectLiveNote(b.db, 'n1', { body: 'painted' });
        await expectNotesMatchServer(a.db, world.server.db);

        // Base client has no color column — PRAGMA would not list it.
        const cols = await a.db.query(sql<{ name: string }>`
          SELECT name FROM pragma_table_info('notes')
        `);
        expect(cols.some((c) => c.name === 'color')).toBe(false);

        const bobColor = await b.db.query(sql<{ color: string | null }>`
          SELECT color FROM notes WHERE id = ${'n1'} AND _deleted_at IS NULL
        `);
        expect(bobColor[0]?.color).toBe('blue');
      } finally {
        await world.dispose();
      }
    });
  }
});
