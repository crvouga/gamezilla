import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeApp,
  acmeKnobs,
  acmeLocalSchema,
  acmeLocalSchemaExtraColumn,
  acmeMutationRegistry,
  acmeQueryRegistry,
  addClient,
  connect,
  defineSyncSystem,
  deleteNote,
  disconnect,
  expectConverged,
  lastMutationOk,
  liveNote,
  mutate,
  noteColor,
  noteColumns,
  notesAllWithColorQuery,
  readNoteTombstoneAt,
  setNote,
  setNoteColor,
  syncVirtualHost,
} from '../apps/acme';

const acmeColorTombstoneSystem = defineSyncSystem(acmeApp, {
  id: 'sync.acmeColorTombstoneSystem',
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

describe('mixed schema tombstone and pending rebase', () => {
  test.each([2110, 2111, 2112])(
    'pending setNoteColor revives peer tombstone; color kept (seed=%i)',
    async (seed) => {
      await using run = await script(acmeColorTombstoneSystem, {
        seed: seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, {
        id: 'alice',
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
      // Bob owns the row so peer soft-delete is authorized; baseline local schema.
      await run.apply(addClient, {
        id: 'bob',
        localSchema: acmeLocalSchema,
        sessionQuery: { name: 'notesAll', params: {} },
      });

      await run.apply(mutate, 'bob', setNote, { id: 'n1', body: 'seed' });
      await expectConverged(run);

      await run.apply(disconnect, 'alice');
      await run.apply(mutate, 'alice', setNoteColor, {
        id: 'n1',
        body: 'alice-pending',
        color: 'red',
      });
      expect(await run.observe(liveNote, 'alice', 'n1')).toMatchObject({
        body: 'alice-pending',
      });

      await run.apply(mutate, 'bob', deleteNote, { id: 'n1' });
      expect(await run.observe(lastMutationOk, 'bob')).toBe(true);
      await run.elapse(400);
      expect(await readNoteTombstoneAt(run, 'server', 'n1')).not.toBeNull();

      await run.apply(connect, 'alice');
      await expectConverged(run);

      // setNoteColor upsert clears deleted_at — revive wins (same as setNote).
      for (const node of ['alice', 'bob', 'server'] as const) {
        expect(await run.observe(liveNote, node, 'n1')).toMatchObject({
          body: 'alice-pending',
        });
      }

      expect((await run.observe(noteColor, 'alice', 'n1'))[0]?.color).toBe(
        'red'
      );
      const bobCols = await run.observe(noteColumns, 'bob');
      expect(bobCols.some((c) => c.name === 'color')).toBe(false);
    }
  );
});
