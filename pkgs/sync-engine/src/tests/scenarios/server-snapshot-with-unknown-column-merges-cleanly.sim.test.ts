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
  defineSyncSystem,
  expectConverged,
  expectLiveNoteAt,
  mutate,
  noteColor,
  noteColumns,
  notesAllWithColorQuery,
  setNoteColor,
  syncVirtualHost,
} from '../apps/acme';

const acmeColorServerSystem = defineSyncSystem(acmeApp, {
  id: 'sync.acmeColorServerSystem',
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

describe('server snapshot with unknown column merges cleanly', () => {
  test.each([730, 731, 732])(
    'client without color ignores server color key (seed=%i)',
    async (seed) => {
      await using run = await script(acmeColorServerSystem, {
        seed: seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, {
        id: 'alice',
        localSchema: acmeLocalSchema,
      });
      await run.apply(addClient, {
        id: 'bob',
        localSchema: acmeLocalSchemaExtraColumn,
      });

      await run.apply(mutate, 'bob', setNoteColor, {
        id: 'n1',
        body: 'painted',
        color: 'blue',
      });
      await expectConverged(run);

      await expectLiveNoteAt(run, 'alice', 'n1', { body: 'painted' });
      await expectLiveNoteAt(run, 'bob', 'n1', { body: 'painted' });

      // Base client has no color column — PRAGMA would not list it.
      const cols = await run.observe(noteColumns('alice'));
      expect(cols.some((c) => c.name === 'color')).toBe(false);

      expect((await run.observe(noteColor('bob', 'n1')))[0]?.color).toBe(
        'blue'
      );
    }
  );
});
