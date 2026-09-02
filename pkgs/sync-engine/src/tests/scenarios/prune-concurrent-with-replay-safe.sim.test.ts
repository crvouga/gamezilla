import { describe, expect, test } from 'bun:test';
import { expectLiveNote, readLiveNotes, setNote } from '../apps/acme';
import { openAcmeWorld } from '../apps/acme/system';

describe('prune concurrent with replay safe', () => {
  test('prune interleaved with uploads; retries dedupe; world converges', async () => {
    await using world = await openAcmeWorld({
      seed: 940,
      knobs: {
        clientCount: 0,
      },
    });

    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n-kept', body: 'before-prune' });
    await world.assertConverged();

    for (let i = 0; i < 8; i += 1) {
      if (i % 2 === 0) {
        using _fault = world.node('alice').httpFault({
          kind: 'dropMutationsResponse',
        });
        await a.mutate(setNote, {
          id: `n-${String(i).padStart(2, '0')}`,
          body: `b${i}`,
        });
        await world.server.pruneArtifacts(0);
        await world.advance(40);
      } else {
        await a.mutate(setNote, {
          id: `n-${String(i).padStart(2, '0')}`,
          body: `b${i}`,
        });
        await world.server.pruneArtifacts(0);
        await world.advance(40);
      }
    }

    await world.assertConverged();
    const server = await readLiveNotes(world.server.db);
    const ids = server.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('n-kept');
    expect(ids).toContain('n-07');
    await expectLiveNote(b.db, 'n-07', { body: 'b7' });
    await expectLiveNote(b.db, 'n-kept', { body: 'before-prune' });
  });

  test.each([941, 942, 943])(
    'seed sweep prune + mutate converges (seed=%i)',
    async (seed) => {
      await using world = await openAcmeWorld({
        seed: seed,
        knobs: {
          clientCount: 0,
        },
      });

      const a = await world.addClient({ id: 'alice' });
      await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: `n-${seed}`, body: 'x' });
      await world.server.pruneArtifacts(0);
      await a.mutate(setNote, { id: `m-${seed}`, body: 'y' });
      await world.server.pruneArtifacts(0);
      await world.assertConverged();
      await expectLiveNote(world.server.db, `n-${seed}`, { body: 'x' });
      await expectLiveNote(world.server.db, `m-${seed}`, { body: 'y' });
    }
  );
});
