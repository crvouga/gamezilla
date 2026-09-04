import { describe, expect, test } from 'bun:test';
import { defineSystem } from '@pkgs/dst';
import {
  ACME_DEFAULT_ARGS,
  acmeApp,
  acmeLocalSchema,
  acmeLocalSchemaExtraColumn,
  acmeLocalSchemaExtraColumnAndTable,
  acmeLocalSchemaExtraTable,
  acmeMutationRegistry,
  acmeQueryRegistry,
  addClient,
  createSyncSurface,
  expectConverged,
  liveNote,
  liveTags,
  localTable,
  mutate,
  noteColor,
  noteColumns,
  notesAllWithColorQuery,
  partition,
  release,
  setNote,
  setNoteColor,
  setTag,
  subscribe,
  syncVirtual,
  tagsAllQuery,
} from '../apps/acme';

/** Non-JSON schema fixture — the system closes over the registries. */
const mixedSchemaFixtures = {
  localSchema: acmeLocalSchemaExtraColumnAndTable,
  mutationRegistry: {
    ...acmeMutationRegistry,
    [setNoteColor.name]: setNoteColor,
    [setTag.name]: setTag,
  },
  queryRegistry: {
    ...acmeQueryRegistry,
    [notesAllWithColorQuery.name]: notesAllWithColorQuery,
    [tagsAllQuery.name]: tagsAllQuery,
  },
} as const;

const acmeMixedSchemaSystem = defineSystem({
  name: 'sync.acme.mixedSchema',
  args: ACME_DEFAULT_ARGS,
  create: (session, args) =>
    createSyncSurface(session, acmeApp, args, mixedSchemaFixtures),
});
acmeMixedSchemaSystem.host({
  default: true,
  name: 'virtual',
  create: () => syncVirtual(),
});

describe('mixed schema three clients partition converge', () => {
  test.each([2100, 2101, 2102])(
    'baseline + color + tags under partition then heal (seed=%i)',
    async (seed) => {
      await using s = await acmeMixedSchemaSystem.script({
        seed: seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, {
        id: 'alice',
        localSchema: acmeLocalSchema,
      });
      await s.apply(addClient, {
        id: 'bob',
        localSchema: acmeLocalSchemaExtraColumn,
        mutationRegistry: {
          ...acmeMutationRegistry,
          [setNoteColor.name]: setNoteColor,
        },
        queryRegistry: {
          ...acmeQueryRegistry,
          [notesAllWithColorQuery.name]: notesAllWithColorQuery,
        },
        sessionQuery: { name: 'notesAllWithColor', params: {} },
      });
      await s.apply(addClient, {
        id: 'carol',
        localSchema: acmeLocalSchemaExtraTable,
        mutationRegistry: {
          ...acmeMutationRegistry,
          [setTag.name]: setTag,
        },
        queryRegistry: {
          ...acmeQueryRegistry,
          [tagsAllQuery.name]: tagsAllQuery,
        },
      });

      await s.apply(mutate, 'alice', setNote, { id: 'shared', body: 'seed' });
      await expectConverged(s);

      await s.apply(partition, 'alice', 'all');
      await s.apply(partition, 'bob', 'all');
      await s.apply(partition, 'carol', 'all');

      await s.apply(mutate, 'alice', setNote, {
        id: 'shared',
        body: 'from-alice',
      });
      await s.apply(mutate, 'bob', setNoteColor, {
        id: 'shared',
        body: 'from-bob',
        color: 'blue',
      });
      await s.apply(mutate, 'carol', setTag, { id: 't1', label: 'urgent' });
      await s.apply(mutate, 'carol', setNote, {
        id: 'carol-only',
        body: 'c-note',
      });

      await s.apply(release, 'alice', 'all');
      await s.apply(release, 'bob', 'all');
      await s.apply(release, 'carol', 'all');

      await s.apply(subscribe, 'carol', 'tagsAll', {});
      await expectConverged(s);

      expect(await s.observe(liveNote, 'alice', 'carol-only')).toMatchObject({
        body: 'c-note',
      });

      // Alice stays on the baseline schema — no `color`, no `tags`.
      const aliceCols = await s.observe(noteColumns, 'alice');
      expect(aliceCols.some((c) => c.name === 'color')).toBe(false);
      expect(await s.observe(localTable, 'alice', 'tags')).toEqual([]);

      expect((await s.observe(noteColor, 'bob', 'shared'))[0]?.color).toBe(
        'blue'
      );

      const shared = await s.observe(liveNote, 'alice', 'shared');
      expect(shared?.body === 'from-alice' || shared?.body === 'from-bob').toBe(
        true
      );

      expect(await s.observe(liveTags, 'carol')).toEqual([
        { id: 't1', label: 'urgent' },
      ]);
    }
  );
});
