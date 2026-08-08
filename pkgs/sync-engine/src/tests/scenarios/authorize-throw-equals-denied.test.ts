import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  expectNotesMatchServer,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld, type SimWorld } from '../../sim/world';

async function pump(
  world: SimWorld,
  work: Promise<unknown>,
  maxVirtualMs = 2_000
): Promise<void> {
  let done = false;
  const tracked = Promise.resolve(work).finally(() => {
    done = true;
  });
  const steps = Math.ceil(maxVirtualMs / 25);
  for (let i = 0; i < steps && !done; i += 1) {
    await world.runFor(25);
  }
  await tracked;
}

describe('authorize throw equals denied', () => {
  test('authorize throw detaches scope, keeps domain rows, stays healthy', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 930,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      await a.mutate(setNote, { id: 'n1', body: 'keep-me' });
      await world.assertConverged();
      await expectLiveNote(a.db, 'n1', { body: 'keep-me' });

      const thrown = a.engine.subscribeQuery('notesAuthorizeThrow', {});
      await pump(world, thrown.waitForFirstSync());
      // Same observable outcome as denied: domain retained, no crash loop.
      await expectLiveNote(a.db, 'n1', { body: 'keep-me' });
      await expectNotesMatchServer(a.db, world.server.db);
      expect(a.engine.status.getSnapshot().lastError).toBeNull();

      thrown.unsubscribe();
      await pump(world, a.engine.refreshQueries());
      await expectLiveNote(a.db, 'n1', { body: 'keep-me' });
      await world.assertConverged();
    } finally {
      await world.dispose();
    }
  });

  test('seed sweep authorize-throw stays healthy', async () => {
    for (const seed of [931, 932, 933] as const) {
      const world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        faults: RELIABLE_FAULTS,
      });
      try {
        const a = await world.addClient({ id: 'alice' });
        await a.mutate(setNote, { id: `n-${seed}`, body: 'x' });
        await world.assertConverged();
        const sub = a.engine.subscribeQuery('notesAuthorizeThrow', {});
        await pump(world, sub.waitForFirstSync());
        await expectLiveNote(a.db, `n-${seed}`, { body: 'x' });
        sub.unsubscribe();
        await world.assertConverged();
      } finally {
        await world.dispose();
      }
    }
  });
});
