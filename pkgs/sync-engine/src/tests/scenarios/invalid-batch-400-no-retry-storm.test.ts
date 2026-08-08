import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('invalid batch 400 no retry storm', () => {
  test.each([880, 881, 882])(
    'invalidMutationsBody backs off then healthy drain (seed=%i)',
    async (seed) => {
      await using world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        faults: RELIABLE_FAULTS,
      });
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      {
        using _fault = world.node('alice').httpFault({
          kind: 'invalidMutationsBody',
        });
        const queued = await a.mutate(setNote, {
          id: 'n1',
          body: 'after-invalid',
        });
        expect(queued.ok).toBe(true);

        // Error path uses backoff — scheduler should not hot-loop.
        await world.runFor(500);
        expect(world.scheduler.pendingCount()).toBeLessThan(50);
      }
      await world.assertConverged();

      await expectLiveNote(b.db, 'n1', { body: 'after-invalid' });
      expect(
        world.isSchedulerQuiescent() || world.scheduler.pendingCount() < 20
      ).toBe(true);
    }
  );
});
