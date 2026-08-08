import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import type { SimClientHandle } from '../../sim/client-factory';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld, type SimWorld } from '../../sim/world';

async function postMutationsPumped(
  world: SimWorld,
  client: SimClientHandle,
  rows: Parameters<SimClientHandle['http']['postMutations']>[0]
): Promise<Awaited<ReturnType<SimClientHandle['http']['postMutations']>>> {
  let done = false;
  const pending = client.http.postMutations(rows).finally(() => {
    done = true;
  });
  for (let i = 0; i < 200 && !done; i += 1) {
    await world.runFor(25);
  }
  return pending;
}

describe('duplicate mutation id different args first wins', () => {
  for (const seed of [830, 831, 832]) {
    test(`hostile re-post same id keeps first body (seed=${seed})`, async () => {
      const world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        faults: RELIABLE_FAULTS,
      });
      try {
        const a = await world.addClient({ id: 'alice' });
        const b = await world.addClient({ id: 'bob' });

        const first = await a.mutate(setNote, { id: 'n1', body: 'first-wins' });
        expect(first.ok).toBe(true);
        if (!first.ok) return;
        await world.assertConverged();

        const hostile = await postMutationsPumped(world, a, [
          {
            id: first.mutationId,
            name: 'setNote',
            args: JSON.stringify({ id: 'n1', body: 'second-should-lose' }),
            clientId: a.deviceId,
            seq: 999,
            createdAt: new Date(world.nowFor('alice')).toISOString(),
          },
        ]);
        expect(hostile.ok).toBe(true);
        expect(hostile.verdicts[0]?.status).toBe('applied');

        await world.assertConverged();

        await expectLiveNote(a.db, 'n1', { body: 'first-wins' });
        await expectLiveNote(b.db, 'n1', { body: 'first-wins' });
        await expectLiveNote(world.server.db, 'n1', { body: 'first-wins' });
      } finally {
        await world.dispose();
      }
    });
  }
});
