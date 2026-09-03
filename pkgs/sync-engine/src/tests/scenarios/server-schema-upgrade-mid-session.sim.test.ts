import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeLocalSchemaExtraColumn,
  acmeMutationRegistry,
  acmeQueryRegistry,
  acmeSystem,
  addClient,
  expectConverged,
  mutate,
  notesAllWithColorQuery,
  restart,
  setNote,
  setNoteColor,
  syncVirtualHost,
} from '../apps/acme';
import {
  expectLiveNoteAt,
  expectNotesAgree,
  noteColor,
  noteColumns,
} from '../apps/acme/reads';

/** Registry pair for the post-upgrade (color-aware) schema variant. */
const UPGRADED = {
  localSchema: acmeLocalSchemaExtraColumn,
  mutationRegistry: {
    ...acmeMutationRegistry,
    [setNoteColor.name]: setNoteColor,
  },
  queryRegistry: {
    ...acmeQueryRegistry,
    [notesAllWithColorQuery.name]: notesAllWithColorQuery,
  },
};

describe('server schema upgrade mid session', () => {
  test.each([2120, 2121, 2122])(
    'server adds color mid-life; old clients ignore; new client stores (seed=%i)',
    async (seed) => {
      await using run = await script(acmeSystem, {
        seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, 'alice');
      await run.apply(addClient, 'bob');

      await run.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'before-upgrade',
      });
      await expectConverged(run);

      await run.apply(restart, 'server', {
        preserveLocalDb: true,
        ...UPGRADED,
      });

      await run.apply(addClient, {
        id: 'carol',
        actorId: 'carol',
        ...UPGRADED,
        sessionQuery: { name: 'notesAllWithColor', params: {} },
      });

      await run.apply(mutate, 'carol', setNoteColor, {
        id: 'n1',
        body: 'after-upgrade',
        color: 'green',
      });
      await run.apply(mutate, 'alice', setNote, {
        id: 'n2',
        body: 'still-baseline',
      });
      await expectConverged(run);

      await expectLiveNoteAt(run, 'alice', 'n1', { body: 'after-upgrade' });
      await expectLiveNoteAt(run, 'bob', 'n1', { body: 'after-upgrade' });
      await expectLiveNoteAt(run, 'carol', 'n1', { body: 'after-upgrade' });
      await expectLiveNoteAt(run, 'alice', 'n2', { body: 'still-baseline' });
      await expectNotesAgree(run, 'alice');

      const aliceCols = await run.observe(noteColumns, 'alice');
      expect(aliceCols.some((c) => c.name === 'color')).toBe(false);

      const carolColor = await run.observe(noteColor, 'carol', 'n1');
      expect(carolColor[0]?.color).toBe('green');
    }
  );
});
