import { describe, expect, test } from 'bun:test';
import {
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
      await using s = await acmeSystem.script({
        seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, 'alice');
      await s.apply(addClient, 'bob');

      await s.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'before-upgrade',
      });
      await expectConverged(s);

      await s.apply(restart, 'server', {
        preserveLocalDb: true,
        ...UPGRADED,
      });

      await s.apply(addClient, {
        id: 'carol',
        actorId: 'carol',
        ...UPGRADED,
        sessionQuery: { name: 'notesAllWithColor', params: {} },
      });

      await s.apply(mutate, 'carol', setNoteColor, {
        id: 'n1',
        body: 'after-upgrade',
        color: 'green',
      });
      await s.apply(mutate, 'alice', setNote, {
        id: 'n2',
        body: 'still-baseline',
      });
      await expectConverged(s);

      await expectLiveNoteAt(s, 'alice', 'n1', { body: 'after-upgrade' });
      await expectLiveNoteAt(s, 'bob', 'n1', { body: 'after-upgrade' });
      await expectLiveNoteAt(s, 'carol', 'n1', { body: 'after-upgrade' });
      await expectLiveNoteAt(s, 'alice', 'n2', { body: 'still-baseline' });
      await expectNotesAgree(s, 'alice');

      const aliceCols = await s.observe(noteColumns, 'alice');
      expect(aliceCols.some((c) => c.name === 'color')).toBe(false);

      const carolColor = await s.observe(noteColor, 'carol', 'n1');
      expect(carolColor[0]?.color).toBe('green');
    }
  );
});
