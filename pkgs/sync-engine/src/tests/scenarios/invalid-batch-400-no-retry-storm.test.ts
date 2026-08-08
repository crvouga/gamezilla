import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('invalid batch 400 no retry storm', () => {
  for (const seed of [880, 881, 882]) {
    test(`invalidMutationsBody backs off then healthy drain (seed=${seed})`, async () => {
      const world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        faults: RELIABLE_FAULTS,
      });
      try {
        const a = await world.addClient({ id: 'alice' });
        const b = await world.addClient({ id: 'bob' });

        world.armHttpFault('alice', { kind: 'invalidMutationsBody' });
        const queued = await a.mutate(setNote, {
          id: 'n1',
          body: 'after-invalid',
        });
        expect(queued.ok).toBe(true);

        // Error path uses backoff — scheduler should not hot-loop.
        await world.runFor(500);
        expect(world.scheduler.pendingCount()).toBeLessThan(50);

        world.clearHttpFaults('alice');
        a.engine.wakeUploads();
        await world.assertConverged();

        await expectLiveNote(b.db, 'n1', { body: 'after-invalid' });
        expect(
          world.isSchedulerQuiescent() || world.scheduler.pendingCount() < 20
        ).toBe(true);
      } finally {
        await world.dispose();
      }
    });
  }
});
