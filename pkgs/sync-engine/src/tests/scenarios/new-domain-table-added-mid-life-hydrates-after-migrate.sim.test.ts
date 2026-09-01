import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { sql } from '@pkgs/sql';
import { defineSyncSystem } from '../../sim/system';
import {
  acmeApp,
  acmeLocalSchema,
  acmeLocalSchemaExtraTable,
  acmeMutationRegistry,
  acmeQueryRegistry,
  expectLiveNote,
  setNote,
  setTag,
  tagsWorldQuery,
} from '../apps/acme';

const acmeExtraTableSystem = defineSyncSystem(acmeApp, {
  id: 'sync.acmeExtraTableSystem',
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

describe('new domain table added mid life hydrates after migrate', () => {
  test.each([750, 751, 752])(
    'tags hydrate after client schema upgrade (seed=%i)',
    async (seed) => {
      await using host = await openWorld(acmeExtraTableSystem, {
        seed: seed,
        knobs: {
          clientCount: 0,
        },
      });
      const world = host.facade;
      const a = await world.addClient({
        id: 'alice',
        localSchema: acmeLocalSchema,
      });
      const b = await world.addClient({
        id: 'bob',
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

      await a.mutate(setNote, { id: 'n1', body: 'kept' });
      await world.assertConverged();

      await b.mutate(setTag, { id: 't1', label: 'urgent' });
      // nudge: bob tagsWorld not in session — refresh after setTag
      await world.until(b.nudge());
      await world.runFor(200);

      const alice2 = await world.node('alice').restart({
        preserveLocalDb: true,
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
