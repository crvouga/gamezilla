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
  createSyncSurface,
  expectConverged,
  expectLiveNoteAt,
  mutate,
  noteColor,
  noteColumns,
  notesAllWithColorQuery,
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

const acmeColorServerSystem = defineSystem({
  name: 'sync.acme.colorServer',
  args: {
    ...ACME_DEFAULT_ARGS,
    sessionQuery: { name: 'notesAllWithColor', params: {} },
  },
  create: (session, args) =>
    createSyncSurface(session, acmeApp, args, colorFixtures),
});
acmeColorServerSystem.host({
  default: true,
  name: 'virtual',
  create: () => syncVirtual(),
});

describe('server snapshot with unknown column merges cleanly', () => {
  test.each([730, 731, 732])(
    'client without color ignores server color key (seed=%i)',
    async (seed) => {
      await using s = await acmeColorServerSystem.script({
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
      });

      await s.apply(mutate, 'bob', setNoteColor, {
        id: 'n1',
        body: 'painted',
        color: 'blue',
      });
      await expectConverged(s);

      await expectLiveNoteAt(s, 'alice', 'n1', { body: 'painted' });
      await expectLiveNoteAt(s, 'bob', 'n1', { body: 'painted' });

      // Base client has no color column — PRAGMA would not list it.
      const cols = await s.observe(noteColumns, 'alice');
      expect(cols.some((c) => c.name === 'color')).toBe(false);

      expect((await s.observe(noteColor, 'bob', 'n1'))[0]?.color).toBe('blue');
    }
  );
});
