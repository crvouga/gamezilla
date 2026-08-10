import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';
import {
  expectLiveNote,
  notesDomainPack,
  notesLocalSchema,
  notesLocalSchemaExtraTable,
  notesMutationRegistry,
  notesQueryRegistry,
  setNote,
  setTag,
  tagsWorldQuery,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

describe('new domain table added mid life hydrates after migrate', () => {
  test.each([750, 751, 752])(
    'tags hydrate after client schema upgrade (seed=%i)',
    async (seed) => {
      await using world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        localSchema: notesLocalSchemaExtraTable,
        mutationRegistry: {
          ...notesMutationRegistry,
          [setTag.name]: setTag,
        },
        queryRegistry: {
          ...notesQueryRegistry,
          [tagsWorldQuery.name]: tagsWorldQuery,
        },
      });
      const a = await world.addClient({
        id: 'alice',
        localSchema: notesLocalSchema,
      });
      const b = await world.addClient({
        id: 'bob',
        localSchema: notesLocalSchemaExtraTable,
        mutationRegistry: {
          ...notesMutationRegistry,
          [setTag.name]: setTag,
        },
        queryRegistry: {
          ...notesQueryRegistry,
          [tagsWorldQuery.name]: tagsWorldQuery,
        },
      });

      await a.mutate(setNote, { id: 'n1', body: 'kept' });
      await world.assertConverged();

      await b.mutate(setTag, { id: 't1', label: 'urgent' });
      // nudge: bob tagsWorld not in session — refresh after setTag
      await world.until(b.nudge());
      await world.runFor(200);

      const alice2 = await world.node('alice').restart({
        preserveLocalDb: true,
        localSchema: notesLocalSchemaExtraTable,
        mutationRegistry: {
          ...notesMutationRegistry,
          [setTag.name]: setTag,
        },
        queryRegistry: {
          ...notesQueryRegistry,
          [tagsWorldQuery.name]: tagsWorldQuery,
        },
      });

      using tagsSub = alice2!.subscribe('tagsWorld', {});
      await world.until(tagsSub.ready);

      await expectLiveNote(alice2!.db, 'n1', { body: 'kept' });
      const tags = await alice2!.db.query(sql<{ id: string; label: string }>`
        SELECT id, label FROM tags
        WHERE deleted_at IS NULL
        ORDER BY id ASC
      `);
      expect(tags).toEqual([{ id: 't1', label: 'urgent' }]);

      await world.assertConverged();
    }
  );
});
