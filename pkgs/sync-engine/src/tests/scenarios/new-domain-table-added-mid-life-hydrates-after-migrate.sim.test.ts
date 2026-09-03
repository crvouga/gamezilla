import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeApp,
  acmeKnobs,
  acmeLocalSchema,
  acmeLocalSchemaExtraTable,
  acmeMutationRegistry,
  acmeQueryRegistry,
  addClient,
  defineSyncSystem,
  expectConverged,
  expectLiveNoteAt,
  liveTags,
  mutate,
  nudge,
  passTime,
  restart,
  setNote,
  setTag,
  subscribe,
  syncVirtualHost,
  tagsAllQuery,
} from '../apps/acme';

const extraTableRegistries = {
  localSchema: acmeLocalSchemaExtraTable,
  mutationRegistry: {
    ...acmeMutationRegistry,
    [setTag.name]: setTag,
  },
  queryRegistry: {
    ...acmeQueryRegistry,
    [tagsAllQuery.name]: tagsAllQuery,
  },
} as const;

const acmeExtraTableSystem = defineSyncSystem(acmeApp, {
  id: 'sync.acmeExtraTableSystem',
  ...extraTableRegistries,
});

describe('new domain table added mid life hydrates after migrate', () => {
  test.each([750, 751, 752])(
    'tags hydrate after client schema upgrade (seed=%i)',
    async (seed) => {
      await using run = await script(acmeExtraTableSystem, {
        seed: seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({
          clientCount: 0,
        }),
        properties: [],
      });

      await run.apply(addClient, {
        id: 'alice',
        localSchema: acmeLocalSchema,
      });
      await run.apply(addClient, { id: 'bob', ...extraTableRegistries });

      await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'kept' });
      await expectConverged(run);

      await run.apply(mutate, 'bob', setTag, { id: 't1', label: 'urgent' });
      // nudge: bob tagsAll not in session — refresh after setTag
      await run.apply(nudge, 'bob');
      await run.apply(passTime, 200);

      await run.apply(restart, 'alice', {
        preserveLocalDb: true,
        ...extraTableRegistries,
      });

      await run.apply(subscribe, 'alice', 'tagsAll', {});

      await expectLiveNoteAt(run, 'alice', 'n1', { body: 'kept' });
      expect(await run.observe(liveTags('alice'))).toEqual([
        { id: 't1', label: 'urgent' },
      ]);

      await expectConverged(run);
    }
  );
});
