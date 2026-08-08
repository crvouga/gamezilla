import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import { expectLiveNote, readLiveNotes, setNote } from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('server 500 mid batch full retry idempotent', () => {
  for (const seed of [850, 851, 852]) {
    test(`in-txn fail rolls back then full apply (seed=${seed})`, async () => {
      const world = await openSimWorld({ seed, faults: RELIABLE_FAULTS });
      try {
        const a = await world.addClient({ id: 'alice' });
        const b = await world.addClient({ id: 'bob' });

        // Fail inside the batch txn after the first mutation attempt → full rollback.
        world.armHttpFault('alice', {
          kind: 'failMutationsInsideTxnAfter',
          after: 0,
        });
        await a.mutate(setNote, { id: 'n1', body: 'txn-atomic' });
        await world.assertConverged();

        await expectLiveNote(b.db, 'n1', { body: 'txn-atomic' });
        expect(
          (await readLiveNotes(world.server.db)).filter((r) => r.id === 'n1')
        ).toHaveLength(1);
      } finally {
        await world.dispose();
      }
    });

    test(`post-commit fail acks via retry dedupe (seed=${seed})`, async () => {
      const world = await openSimWorld({
        seed: seed + 10,
        faults: RELIABLE_FAULTS,
      });
      try {
        const a = await world.addClient({ id: 'alice' });
        const b = await world.addClient({ id: 'bob' });

        world.armHttpFault('alice', { kind: 'failMutationsAfterCommit' });
        await a.mutate(setNote, { id: 'n2', body: 'post-commit' });
        await world.assertConverged();

        await expectLiveNote(b.db, 'n2', { body: 'post-commit' });
        expect(
          (await readLiveNotes(world.server.db)).filter((r) => r.id === 'n2')
        ).toHaveLength(1);
      } finally {
        await world.dispose();
      }
    });
  }
});
