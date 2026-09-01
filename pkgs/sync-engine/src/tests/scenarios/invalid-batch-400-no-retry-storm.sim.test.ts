import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { expectLiveNote, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('invalid batch 400 no retry storm', () => {
  test.each([880, 881, 882])(
    'invalidMutationsBody backs off then healthy drain (seed=%i)',
    async (seed) => {
      await using host = await openWorld(acmeSystem, {
        seed: seed,
        knobs: {
          clientCount: 0,
        },
      });
      const world = host.facade;
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
        expect(world.pendingEventCount()).toBeLessThan(50);
      }
      await world.assertConverged();

      await expectLiveNote(b.db, 'n1', { body: 'after-invalid' });
      expect(
        world.isSchedulerQuiescent() || world.pendingEventCount() < 20
      ).toBe(true);
    }
  );
});
