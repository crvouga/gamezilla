import { describe, expect, test } from 'bun:test';
import {
  acmeLocalSchemaExtraColumn,
  acmeSystem,
  addClient,
  expectConverged,
  expectLiveNoteAt,
  mutate,
  noteColor,
  runSql,
  setNote,
} from '../apps/acme';

describe('client column missing from server snapshot not clobbered', () => {
  test.each([740, 741, 742])(
    'local color survives peer body update (seed=%i)',
    async (seed) => {
      // Server stays on base schema (no color). Client has extra column.
      await using s = await acmeSystem.script({
        seed: seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, {
        id: 'alice',
        localSchema: acmeLocalSchemaExtraColumn,
      });
      await s.apply(addClient, { id: 'bob' });

      await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'v1' });
      await expectConverged(s);

      // Domain-only local write — not uploaded (server has no color column).
      await s.apply(
        runSql,
        'alice',
        `UPDATE notes SET color = 'red' WHERE id = 'n1'`
      );
      expect((await s.observe(noteColor, 'alice', 'n1'))[0]?.color).toBe('red');

      await s.apply(mutate, 'bob', setNote, { id: 'n1', body: 'from-bob' });
      await expectConverged(s);

      await expectLiveNoteAt(s, 'alice', 'n1', { body: 'from-bob' });
      expect((await s.observe(noteColor, 'alice', 'n1'))[0]?.color).toBe('red');
    }
  );
});
