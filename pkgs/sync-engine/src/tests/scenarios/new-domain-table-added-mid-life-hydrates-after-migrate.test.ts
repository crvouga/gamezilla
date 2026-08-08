import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  expectLiveNote,
  notesLocalSchema,
  notesLocalSchemaExtraTable,
  notesMutationRegistry,
  notesQueryRegistry,
  setNote,
  setTag,
  tagsWorldQuery,
} from '../../sim/notes-app';
import { openSimWorld, type SimWorld } from '../../sim/world';

async function pump(
  world: SimWorld,
  work: Promise<unknown>,
  maxVirtualMs = 2_000
): Promise<void> {
  let done = false;
  const tracked = Promise.resolve(work).finally(() => {
    done = true;
  });
  const steps = Math.ceil(maxVirtualMs / 25);
  for (let i = 0; i < steps && !done; i += 1) {
    await world.runFor(25);
  }
  await tracked;
}

describe('new domain table added mid life hydrates after migrate', () => {
  for (const seed of [750, 751, 752]) {
    test(`tags hydrate after client schema upgrade (seed=${seed})`, async () => {
      const world = await openSimWorld({
        seed,
        faults: RELIABLE_FAULTS,
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
      try {
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
        await pump(world, b.engine.refreshQueries());
        await world.runFor(200);

        const alice2 = await world.restartClient('alice', {
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

        const tagsSub = alice2.engine.subscribeQuery('tagsWorld', {});
        await pump(world, tagsSub.waitForFirstSync());

        await expectLiveNote(alice2.db, 'n1', { body: 'kept' });
        const tags = await alice2.db.query(sql<{ id: string; label: string }>`
          SELECT id, label FROM tags
          WHERE _deleted_at IS NULL
          ORDER BY id ASC
        `);
        expect(tags).toEqual([{ id: 't1', label: 'urgent' }]);

        tagsSub.unsubscribe();
        await world.assertConverged();
      } finally {
        await world.dispose();
      }
    });
  }
});
