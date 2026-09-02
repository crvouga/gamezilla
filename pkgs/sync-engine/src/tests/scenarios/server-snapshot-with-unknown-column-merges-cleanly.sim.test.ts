import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/dst';
import { sql } from '@pkgs/sql';
import { defineSyncSystem } from '../../sim/scenario';
import {
  acmeApp,
  acmeLocalSchema,
  acmeLocalSchemaExtraColumn,
  acmeMutationRegistry,
  acmeQueryRegistry,
  expectLiveNote,
  expectNotesMatchServer,
  notesWorldWithColorQuery,
  setNoteColor,
} from '../apps/acme';

const acmeColorServerSystem = defineSyncSystem(acmeApp, {
  id: 'sync.acmeColorServerSystem',
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

describe('server snapshot with unknown column merges cleanly', () => {
  test.each([730, 731, 732])(
    'client without color ignores server color key (seed=%i)',
    async (seed) => {
      await using world = await openWorld(acmeColorServerSystem, {
        seed: seed,
        knobs: {
          clientCount: 0,
        },
      });

      const a = await world.addClient({
        id: 'alice',
        localSchema: acmeLocalSchema,
      });
      const b = await world.addClient({
        id: 'bob',
        localSchema: acmeLocalSchemaExtraColumn,
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
        SELECT color FROM notes WHERE id = ${'n1'} AND deleted_at IS NULL
      `);
      expect(bobColor[0]?.color).toBe('blue');
    }
  );
});
