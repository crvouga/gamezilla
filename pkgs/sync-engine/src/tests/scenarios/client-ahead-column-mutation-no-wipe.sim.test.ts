import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { sql } from '@pkgs/sql';
import { syncFacade } from '../../sim/system';
import {
  acmeLocalSchemaExtraColumn,
  acmeMutationRegistry,
  expectLiveNote,
  isLiveNote,
  setNote,
  setNoteColor,
} from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('client ahead column mutation no wipe', () => {
  test.each([2130, 2131, 2132])(
    'client writes color before server DDL: no wipe, no hot loop (seed=%i)',
    async (seed) => {
      // Unsupported deploy order — pin that the engine stays healthy.
      await using host = await openWorld(acmeSystem, {
        seed: seed,
        knobs: {
          clientCount: 0,
        },
      });
      const world = syncFacade(host.state);
      // Session stays on notesWorld (server knows it); only local DDL + mutation
      // registry are ahead of the server.
      const alice = await world.addClient({
        id: 'alice',
        localSchema: acmeLocalSchemaExtraColumn,
        mutationRegistry: {
          ...acmeMutationRegistry,
          [setNoteColor.name]: setNoteColor,
        },
      });
      const bob = await world.addClient({ id: 'bob' });

      await bob.mutate(setNote, { id: 'ok', body: 'healthy' });
      await world.runFor(400);
      await expectLiveNote(alice.db, 'ok', { body: 'healthy' });

      const ahead = await alice.mutate(setNoteColor, {
        id: 'ahead',
        body: 'client-ahead',
        color: 'purple',
      });
      expect(ahead.ok).toBe(true);

      // Give uploads time to fail/retry; must not wipe local DB or hot-loop.
      await world.runFor(2_000);

      expect(await isLiveNote(world.server.db, 'ahead')).toBe(false);
      expect(await isLiveNote(bob.db, 'ahead')).toBe(false);

      // Engine stays mounted (not revoked/wiped).
      const status = alice.getSyncEngine().status.getSnapshot();
      expect(status).toBeDefined();
      expect(alice.db).toBeDefined();

      const cols = await alice.db.query(sql<{ name: string }>`
        SELECT name FROM pragma_table_info('notes')
      `);
      expect(cols.some((c) => c.name === 'color')).toBe(true);

      // Healthy mutate from peer still paints; alice was not wiped.
      await bob.mutate(setNote, { id: 'ok2', body: 'still-works' });
      await world.runFor(800);
      await expectLiveNote(alice.db, 'ok2', { body: 'still-works' });
      await expectLiveNote(alice.db, 'ok', { body: 'healthy' });
    }
  );
});
