import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { syncFacade } from '../../sim/system';
import { expectLiveNote, readLiveNotes, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('server 500 mid batch full retry idempotent', () => {
  test.each([850, 851, 852])(
    'in-txn fail rolls back then full apply (seed=%i)',
    async (seed) => {
      await using host = await openWorld(acmeSystem, {
        seed: seed,
        knobs: {
          clientCount: 0,
        },
      });
      const world = syncFacade(host.state);
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      // Fail inside the batch txn after the first mutation attempt → full rollback.
      using _fault = world.node('alice').httpFault({
        kind: 'failMutationsInsideTxnAfter',
        after: 0,
      });
      await a.mutate(setNote, { id: 'n1', body: 'txn-atomic' });
      await world.assertConverged();

      await expectLiveNote(b.db, 'n1', { body: 'txn-atomic' });
      expect(
        (await readLiveNotes(world.server.db)).filter((r) => r.id === 'n1')
      ).toHaveLength(1);
    }
  );

  test.each([850, 851, 852])(
    'post-commit fail acks via retry dedupe (seed=%i)',
    async (seed) => {
      await using host = await openWorld(acmeSystem, {
        seed: seed + 10,
        knobs: {
          clientCount: 0,
        },
      });
      const world = syncFacade(host.state);
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      using _fault = world.node('alice').httpFault({
        kind: 'failMutationsAfterCommit',
      });
      await a.mutate(setNote, { id: 'n2', body: 'post-commit' });
      await world.assertConverged();

      await expectLiveNote(b.db, 'n2', { body: 'post-commit' });
      expect(
        (await readLiveNotes(world.server.db)).filter((r) => r.id === 'n2')
      ).toHaveLength(1);
    }
  );
});
