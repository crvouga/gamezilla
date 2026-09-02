import { describe, expect, test } from 'bun:test';
import { expectLiveNote, readLiveNotes, setNote } from '../apps/acme';
import { openAcmeWorld } from '../apps/acme/system';

describe('concurrent topic seq allocation monotonic', () => {
  test('overlapping mutates on shared topic converge without torn state', async () => {
    await using world = await openAcmeWorld({
      seed: 920,
      knobs: {
        clientCount: 0,
      },
    });

    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    const writes: Promise<unknown>[] = [];
    for (let i = 0; i < 12; i += 1) {
      writes.push(
        a.mutate(setNote, {
          id: `a-${String(i).padStart(2, '0')}`,
          body: `a${i}`,
        })
      );
      writes.push(
        b.mutate(setNote, {
          id: `b-${String(i).padStart(2, '0')}`,
          body: `b${i}`,
        })
      );
      if (i % 3 === 0) await world.advance(5);
    }
    await Promise.all(writes);
    await world.assertConverged();

    await world.checkInvariants();
    const server = await readLiveNotes(world.server.db);
    expect(server.length).toBe(24);
    await expectLiveNote(a.db, 'a-00', { body: 'a0' });
    await expectLiveNote(b.db, 'b-11', { body: 'b11' });
  });

  test.each([921, 922, 923])(
    'seed sweep concurrent writers converge (seed=%i)',
    async (seed) => {
      await using world = await openAcmeWorld({
        seed: seed,
        knobs: {
          clientCount: 0,
        },
      });

      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await Promise.all([
        a.mutate(setNote, { id: `a-${seed}`, body: 'x' }),
        b.mutate(setNote, { id: `b-${seed}`, body: 'y' }),
      ]);
      await world.assertConverged();
      await world.checkInvariants();
    }
  );
});
