import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { expectLiveNote, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('duplicate mutation id different args first wins', () => {
  test.each([830, 831, 832])(
    'hostile re-post same id keeps first body (seed=%i)',
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

      const first = await a.mutate(setNote, { id: 'n1', body: 'first-wins' });
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      await world.assertConverged();

      const hostileP = a.postMutations([
        {
          id: first.mutationId,
          name: 'setNote',
          args: JSON.stringify({ id: 'n1', body: 'second-should-lose' }),
          clientId: a.deviceId,
          seq: 999,
          createdAt: new Date(world.node('alice').now()).toISOString(),
        },
      ]);
      await world.until(hostileP);
      const hostile = await hostileP;
      expect(hostile.ok).toBe(true);
      expect(hostile.verdicts[0]?.status).toBe('applied');

      await world.assertConverged();

      await expectLiveNote(a.db, 'n1', { body: 'first-wins' });
      await expectLiveNote(b.db, 'n1', { body: 'first-wins' });
      await expectLiveNote(world.server.db, 'n1', { body: 'first-wins' });
    }
  );
});
