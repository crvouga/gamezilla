import { describe, expect, test } from 'bun:test';
import { defineSystem } from '@pkgs/dst';
import {
  ACME_DEFAULT_ARGS,
  acmeApp,
  acmeLocalSchema,
  acmeLocalSchemaExtraTable,
  acmeMutationRegistry,
  acmeQueryRegistry,
  addClient,
  createSyncSurface,
  expectConverged,
  expectLiveNoteAt,
  liveTags,
  mutate,
  nudge,
  restart,
  setNote,
  setTag,
  subscribe,
  syncVirtual,
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

/** Non-JSON schema fixture — the system closes over the registries. */
const acmeExtraTableSystem = defineSystem({
  name: 'sync.acme.extraTable',
  args: ACME_DEFAULT_ARGS,
  create: (session, args) =>
    createSyncSurface(session, acmeApp, args, extraTableRegistries),
});
acmeExtraTableSystem.host({
  default: true,
  name: 'virtual',
  create: () => syncVirtual(),
});

describe('new domain table added mid life hydrates after migrate', () => {
  test.each([750, 751, 752])(
    'tags hydrate after client schema upgrade (seed=%i)',
    async (seed) => {
      await using s = await acmeExtraTableSystem.script({
        seed: seed,
        args: {
          clientCount: 0,
        },
      });

      await s.apply(addClient, {
        id: 'alice',
        localSchema: acmeLocalSchema,
      });
      await s.apply(addClient, { id: 'bob', ...extraTableRegistries });

      await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'kept' });
      await expectConverged(s);

      await s.apply(mutate, 'bob', setTag, { id: 't1', label: 'urgent' });
      // nudge: bob tagsAll not in session — refresh after setTag
      await s.apply(nudge, 'bob');
      await s.elapse(200);

      await s.apply(restart, 'alice', {
        preserveLocalDb: true,
        ...extraTableRegistries,
      });

      await s.apply(subscribe, 'alice', 'tagsAll', {});

      await expectLiveNoteAt(s, 'alice', 'n1', { body: 'kept' });
      expect(await s.observe(liveTags, 'alice')).toEqual([
        { id: 't1', label: 'urgent' },
      ]);

      await expectConverged(s);
    }
  );
});
