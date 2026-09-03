import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeApp,
  acmeDraws,
  acmeLocalSchema,
  acmeLocalSchemaExtraColumn,
  acmeLocalSchemaExtraColumnAndTable,
  acmeLocalSchemaExtraTable,
  acmeMutationRegistry,
  acmeQueryRegistry,
  addClient,
  converge,
  defineSyncSystem,
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
  syncVirtualHost,
  tagsAllQuery,
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
    [notesAllWithColorQuery.name]: notesAllWithColorQuery,
    [tagsAllQuery.name]: tagsAllQuery,
  },
});

describe('mixed schema three clients partition converge', () => {
  test.each([2100, 2101, 2102])(
    'baseline + color + tags under partition then heal (seed=%i)',
    async (seed) => {
      await using run = await start(acmeMixedSchemaSystem, {
        seed: seed,
        host: syncVirtualHost(),
        draws: acmeDraws({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, {
        id: 'alice',
        localSchema: acmeLocalSchema,
      });
      await run.apply(addClient, {
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
      await run.apply(addClient, {
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

      await run.apply(mutate, 'alice', setNote, { id: 'shared', body: 'seed' });
      await run.apply(converge);

      await run.apply(partition, 'alice', 'all');
      await run.apply(partition, 'bob', 'all');
      await run.apply(partition, 'carol', 'all');

      await run.apply(mutate, 'alice', setNote, {
        id: 'shared',
        body: 'from-alice',
      });
      await run.apply(mutate, 'bob', setNoteColor, {
        id: 'shared',
        body: 'from-bob',
        color: 'blue',
      });
      await run.apply(mutate, 'carol', setTag, { id: 't1', label: 'urgent' });
      await run.apply(mutate, 'carol', setNote, {
        id: 'carol-only',
        body: 'c-note',
      });

      await run.apply(release, 'alice', 'all');
      await run.apply(release, 'bob', 'all');
      await run.apply(release, 'carol', 'all');

      await run.apply(subscribe, 'carol', 'tagsAll', {});
      await run.apply(converge);

      expect(await run.observe(liveNote('alice', 'carol-only'))).toMatchObject({
        body: 'c-note',
      });

      // Alice stays on the baseline schema — no `color`, no `tags`.
      const aliceCols = await run.observe(noteColumns('alice'));
      expect(aliceCols.some((c) => c.name === 'color')).toBe(false);
      expect(await run.observe(localTable('alice', 'tags'))).toEqual([]);

      expect((await run.observe(noteColor('bob', 'shared')))[0]?.color).toBe(
        'blue'
      );

      const shared = await run.observe(liveNote('alice', 'shared'));
      expect(shared?.body === 'from-alice' || shared?.body === 'from-bob').toBe(
        true
      );

      expect(await run.observe(liveTags('carol'))).toEqual([
        { id: 't1', label: 'urgent' },
      ]);
    }
  );
});
