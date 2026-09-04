import { describe, expect, test } from 'bun:test';
import {
  acmeLocalSchemaExtraColumn,
  acmeMutationRegistry,
  acmeSystem,
  addClient,
  connection,
  isNoteLiveAt,
  lastMutationOk,
  liveNote,
  mutate,
  noteColumns,
  setNote,
  setNoteColor,
} from '../apps/acme';

describe('client ahead column mutation no wipe', () => {
  test.each([2130, 2131, 2132])(
    'client writes color before server DDL: no wipe, no hot loop (seed=%i)',
    async (seed) => {
      // Unsupported deploy order — pin that the engine stays healthy.
      await using s = await acmeSystem.script({
        seed: seed,
        args: { clientCount: 0 },
      });

      // Session stays on notesAll (server knows it); only local DDL + mutation
      // registry are ahead of the server.
      await s.apply(addClient, {
        id: 'alice',
        localSchema: acmeLocalSchemaExtraColumn,
        mutationRegistry: {
          ...acmeMutationRegistry,
          [setNoteColor.name]: setNoteColor,
        },
      });
      await s.apply(addClient, { id: 'bob' });

      await s.apply(mutate, 'bob', setNote, { id: 'ok', body: 'healthy' });
      await s.elapse(400);
      expect(await s.observe(liveNote, 'alice', 'ok')).toMatchObject({
        body: 'healthy',
      });

      await s.apply(mutate, 'alice', setNoteColor, {
        id: 'ahead',
        body: 'client-ahead',
        color: 'purple',
      });
      expect(await s.observe(lastMutationOk, 'alice')).toBe(true);

      // Give uploads time to fail/retry; must not wipe local DB or hot-loop.
      await s.elapse(2_000);

      expect(await isNoteLiveAt(s, 'server', 'ahead')).toBe(false);
      expect(await isNoteLiveAt(s, 'bob', 'ahead')).toBe(false);

      // Engine stays mounted (not revoked/wiped) and keeps its ahead-of-server
      // column.
      expect(await s.observe(connection, 'alice')).not.toBeNull();
      const cols = await s.observe(noteColumns, 'alice');
      expect(cols.some((c) => c.name === 'color')).toBe(true);

      // Healthy mutate from peer still paints; alice was not wiped.
      await s.apply(mutate, 'bob', setNote, {
        id: 'ok2',
        body: 'still-works',
      });
      await s.elapse(800);
      expect(await s.observe(liveNote, 'alice', 'ok2')).toMatchObject({
        body: 'still-works',
      });
      expect(await s.observe(liveNote, 'alice', 'ok')).toMatchObject({
        body: 'healthy',
      });
    }
  );
});
