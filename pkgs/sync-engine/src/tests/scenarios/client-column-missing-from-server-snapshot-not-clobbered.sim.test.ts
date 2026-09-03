import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeLocalSchemaExtraColumn,
  acmeSystem,
  addClient,
  expectConverged,
  expectLiveNoteAt,
  mutate,
  noteColor,
  runSql,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('client column missing from server snapshot not clobbered', () => {
  test.each([740, 741, 742])(
    'local color survives peer body update (seed=%i)',
    async (seed) => {
      // Server stays on base schema (no color). Client has extra column.
      await using run = await script(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, {
        id: 'alice',
        localSchema: acmeLocalSchemaExtraColumn,
      });
      await run.apply(addClient, { id: 'bob' });

      await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'v1' });
      await expectConverged(run);

      // Domain-only local write — not uploaded (server has no color column).
      await run.apply(
        runSql,
        'alice',
        `UPDATE notes SET color = 'red' WHERE id = 'n1'`
      );
      expect((await run.observe(noteColor('alice', 'n1')))[0]?.color).toBe(
        'red'
      );

      await run.apply(mutate, 'bob', setNote, { id: 'n1', body: 'from-bob' });
      await expectConverged(run);

      await expectLiveNoteAt(run, 'alice', 'n1', { body: 'from-bob' });
      expect((await run.observe(noteColor('alice', 'n1')))[0]?.color).toBe(
        'red'
      );
    }
  );
});
