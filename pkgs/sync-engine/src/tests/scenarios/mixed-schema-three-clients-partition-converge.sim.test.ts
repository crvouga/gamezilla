import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { sql } from '@pkgs/sql';
import { defineSyncSystem, syncFacade } from '../../sim/system';
import {
  acmeApp,
  acmeLocalSchema,
  acmeLocalSchemaExtraColumn,
  acmeLocalSchemaExtraColumnAndTable,
  acmeLocalSchemaExtraTable,
  acmeMutationRegistry,
  acmeQueryRegistry,
  expectLiveNote,
  expectNotesMatchServer,
  notesWorldWithColorQuery,
  setNote,
  setNoteColor,
  setTag,
  tagsWorldQuery,
} from '../apps/acme';

const acmeMixedSchemaSystem = defineSyncSystem(acmeApp, {
  id: 'sync.acmeMixedSchemaSystem',
  localSchema: acmeLocalSchemaExtraColumnAndTable,
  mutationRegistry: {
    ...acmeMutationRegistry,
    [setNoteColor.name]: setNoteColor,
    [setTag.name]: setTag,
  },
  queryRegistry: {
    ...acmeQueryRegistry,
    [notesWorldWithColorQuery.name]: notesWorldWithColorQuery,
    [tagsWorldQuery.name]: tagsWorldQuery,
  },
});

describe('mixed schema three clients partition converge', () => {
  test.each([2100, 2101, 2102])(
    'baseline + color + tags under partition then heal (seed=%i)',
    async (seed) => {
      await using host = await openWorld(acmeMixedSchemaSystem, {
        seed: seed,
        knobs: {
          clientCount: 0,
        },
      });
      const world = syncFacade(host.system);

      const alice = await world.addClient({
        id: 'alice',
        localSchema: acmeLocalSchema,
      });
      const bob = await world.addClient({
        id: 'bob',
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
      const carol = await world.addClient({
        id: 'carol',
        localSchema: acmeLocalSchemaExtraTable,
        mutationRegistry: {
          ...acmeMutationRegistry,
          [setTag.name]: setTag,
        },
        queryRegistry: {
          ...acmeQueryRegistry,
          [tagsWorldQuery.name]: tagsWorldQuery,
        },
      });

      await alice.mutate(setNote, { id: 'shared', body: 'seed' });
      await world.assertConverged();

      {
        using _a = world.net('alice', 'all').set('down');
        using _b = world.net('bob', 'all').set('down');
        using _c = world.net('carol', 'all').set('down');

        await alice.mutate(setNote, { id: 'shared', body: 'from-alice' });
        await bob.mutate(setNoteColor, {
          id: 'shared',
          body: 'from-bob',
          color: 'blue',
        });
        await carol.mutate(setTag, { id: 't1', label: 'urgent' });
        await carol.mutate(setNote, { id: 'carol-only', body: 'c-note' });
      }

      using tagsSub = carol.subscribe('tagsWorld', {});
      await world.until(tagsSub.ready);
      await world.assertConverged();

      await expectLiveNote(alice.db, 'carol-only', { body: 'c-note' });
      await expectNotesMatchServer(alice.db, world.server.db);
      await expectNotesMatchServer(bob.db, world.server.db);

      const aliceCols = await alice.db.query(sql<{ name: string }>`
        SELECT name FROM pragma_table_info('notes')
      `);
      expect(aliceCols.some((c) => c.name === 'color')).toBe(false);

      const aliceTables = await alice.db.query(sql<{ name: string }>`
        SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tags'
      `);
      expect(aliceTables).toEqual([]);

      const bobColor = await bob.db.query(sql<{ color: string | null }>`
        SELECT color FROM notes WHERE id = ${'shared'} AND deleted_at IS NULL
      `);
      expect(bobColor[0]?.color).toBe('blue');

      const shared = await alice.db.query(sql<{ body: string }>`
        SELECT body FROM notes WHERE id = ${'shared'} AND deleted_at IS NULL
      `);
      expect(
        shared[0]?.body === 'from-alice' || shared[0]?.body === 'from-bob'
      ).toBe(true);

      const tags = await carol.db.query(sql<{ id: string; label: string }>`
        SELECT id, label FROM tags WHERE deleted_at IS NULL ORDER BY id ASC
      `);
      expect(tags).toEqual([{ id: 't1', label: 'urgent' }]);
    }
  );
});
