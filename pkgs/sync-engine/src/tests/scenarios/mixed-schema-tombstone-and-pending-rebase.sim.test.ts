import { describe, expect, test } from 'bun:test';
import { defineSystem } from '@pkgs/dst';
import {
  ACME_DEFAULT_ARGS,
  acmeApp,
  acmeLocalSchema,
  acmeLocalSchemaExtraColumn,
  acmeMutationRegistry,
  acmeQueryRegistry,
  addClient,
  connect,
  createSyncSurface,
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
  syncVirtual,
} from '../apps/acme';

/** Non-JSON schema fixture — the system closes over the registries. */
const colorFixtures = {
  localSchema: acmeLocalSchemaExtraColumn,
  mutationRegistry: {
    ...acmeMutationRegistry,
    [setNoteColor.name]: setNoteColor,
  },
  queryRegistry: {
    ...acmeQueryRegistry,
    [notesAllWithColorQuery.name]: notesAllWithColorQuery,
  },
} as const;

const acmeColorTombstoneSystem = defineSystem({
  name: 'sync.acme.colorTombstone',
  args: {
    ...ACME_DEFAULT_ARGS,
    sessionQuery: { name: 'notesAllWithColor', params: {} },
  },
  create: (session, args) =>
    createSyncSurface(session, acmeApp, args, colorFixtures),
});
acmeColorTombstoneSystem.host({
  default: true,
  name: 'virtual',
  create: () => syncVirtual(),
});

describe('mixed schema tombstone and pending rebase', () => {
  test.each([2110, 2111, 2112])(
    'pending setNoteColor revives peer tombstone; color kept (seed=%i)',
    async (seed) => {
      await using s = await acmeColorTombstoneSystem.script({
        seed: seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, {
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
      await s.apply(addClient, {
        id: 'bob',
        localSchema: acmeLocalSchema,
        sessionQuery: { name: 'notesAll', params: {} },
      });

      await s.apply(mutate, 'bob', setNote, { id: 'n1', body: 'seed' });
      await expectConverged(s);

      await s.apply(disconnect, 'alice');
      await s.apply(mutate, 'alice', setNoteColor, {
        id: 'n1',
        body: 'alice-pending',
        color: 'red',
      });
      expect(await s.observe(liveNote, 'alice', 'n1')).toMatchObject({
        body: 'alice-pending',
      });

      await s.apply(mutate, 'bob', deleteNote, { id: 'n1' });
      expect(await s.observe(lastMutationOk, 'bob')).toBe(true);
      await s.elapse(400);
      expect(await readNoteTombstoneAt(s, 'server', 'n1')).not.toBeNull();

      await s.apply(connect, 'alice');
      await expectConverged(s);

      // setNoteColor upsert clears deleted_at — revive wins (same as setNote).
      for (const node of ['alice', 'bob', 'server'] as const) {
        expect(await s.observe(liveNote, node, 'n1')).toMatchObject({
          body: 'alice-pending',
        });
      }

      expect((await s.observe(noteColor, 'alice', 'n1'))[0]?.color).toBe('red');
      const bobCols = await s.observe(noteColumns, 'bob');
      expect(bobCols.some((c) => c.name === 'color')).toBe(false);
    }
  );
});
