import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { syncFacade } from '../../sim/system';
import {
  acmeMutationRegistry,
  expectLiveNote,
  expectNotesMatchServer,
  setNote,
  setNoteArgsLoose,
} from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('args schema tightened server rejects stale args', () => {
  test.each([790, 791, 792])(
    'loose client args rejected by tight server (seed=%i)',
    async (seed) => {
      await using host = await openWorld(acmeSystem, {
        seed: seed,
        knobs: {
          clientCount: 0,
          rowImageFanout: false,
        },
      });
      const world = syncFacade(host.system);
      const a = await world.addClient({
        id: 'alice',
        mutationRegistry: {
          ...acmeMutationRegistry,
          [setNoteArgsLoose.name]: setNoteArgsLoose,
        },
      });
      const b = await world.addClient({ id: 'bob' });

      // Seed an existing row so reject heals via snapshot (absence ≠ delete).
      await a.mutate(setNote, { id: 'n1', body: 'short' });
      await world.assertConverged();

      await a.disconnect();
      const longBody = 'x'.repeat(64);
      const rejected = await a.mutate(setNoteArgsLoose, {
        id: 'n1',
        body: longBody,
      });
      expect(rejected.ok).toBe(true);
      if (!rejected.ok) return;

      await a.connect();
      await world.until(a.outcome(rejected.mutationId), { budgetMs: 5_000 });
      expect(await a.outcome(rejected.mutationId)).toBe('rejected');

      const unacked = await a.rejections();
      expect(unacked.length).toBeGreaterThanOrEqual(1);
      expect(unacked.some((r) => r.mutationId === rejected.mutationId)).toBe(
        true
      );

      await expectLiveNote(world.server.db, 'n1', { body: 'short' });
      await expectLiveNote(b.db, 'n1', { body: 'short' });

      // Bump server hash so alice's optimistic long body is overwritten.
      await b.mutate(setNote, { id: 'ok', body: 'healthy' });
      await world.assertConverged();
      await expectLiveNote(a.db, 'n1', { body: 'short' });
      await expectLiveNote(a.db, 'ok', { body: 'healthy' });
      await expectNotesMatchServer(a.db, world.server.db);
    }
  );
});
