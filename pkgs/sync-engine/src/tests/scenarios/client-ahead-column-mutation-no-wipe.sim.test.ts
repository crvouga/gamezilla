import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
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
  passTime,
  setNote,
  setNoteColor,
  syncVirtualHost,
} from '../apps/acme';

describe('client ahead column mutation no wipe', () => {
  test.each([2130, 2131, 2132])(
    'client writes color before server DDL: no wipe, no hot loop (seed=%i)',
    async (seed) => {
      // Unsupported deploy order — pin that the engine stays healthy.
      await using run = await start(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        draws: acmeDraws({ clientCount: 0 }),
        properties: [],
      });

      // Session stays on notesAll (server knows it); only local DDL + mutation
      // registry are ahead of the server.
      await run.apply(addClient, {
        id: 'alice',
        localSchema: acmeLocalSchemaExtraColumn,
        mutationRegistry: {
          ...acmeMutationRegistry,
          [setNoteColor.name]: setNoteColor,
        },
      });
      await run.apply(addClient, { id: 'bob' });

      await run.apply(mutate, 'bob', setNote, { id: 'ok', body: 'healthy' });
      await run.apply(passTime, 400);
      expect(await run.observe(liveNote('alice', 'ok'))).toMatchObject({
        body: 'healthy',
      });

      await run.apply(mutate, 'alice', setNoteColor, {
        id: 'ahead',
        body: 'client-ahead',
        color: 'purple',
      });
      expect(await run.observe(lastMutationOk('alice'))).toBe(true);

      // Give uploads time to fail/retry; must not wipe local DB or hot-loop.
      await run.apply(passTime, 2_000);

      expect(await isNoteLiveAt(run, 'server', 'ahead')).toBe(false);
      expect(await isNoteLiveAt(run, 'bob', 'ahead')).toBe(false);

      // Engine stays mounted (not revoked/wiped) and keeps its ahead-of-server
      // column.
      expect(await run.observe(connection('alice'))).not.toBeNull();
      const cols = await run.observe(noteColumns('alice'));
      expect(cols.some((c) => c.name === 'color')).toBe(true);

      // Healthy mutate from peer still paints; alice was not wiped.
      await run.apply(mutate, 'bob', setNote, {
        id: 'ok2',
        body: 'still-works',
      });
      await run.apply(passTime, 800);
      expect(await run.observe(liveNote('alice', 'ok2'))).toMatchObject({
        body: 'still-works',
      });
      expect(await run.observe(liveNote('alice', 'ok'))).toMatchObject({
        body: 'healthy',
      });
    }
  );
});
