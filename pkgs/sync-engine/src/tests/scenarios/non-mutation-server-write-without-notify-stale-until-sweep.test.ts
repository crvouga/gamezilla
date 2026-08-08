import { describe, test } from 'bun:test';
import {
  expectLiveNote,
  notesDomainPack,
  setNote,
  writeNoteBody,
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

describe('non mutation server write without notify stale until sweep', () => {
  // Domain write outside mutation replay must notify; missed notify ⇒ stale until sweep.
  test('writeNoteBody notify false leaves peers stale until refresh', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 1090,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'n1', body: 'v1' });
      await world.assertConverged();

      await writeNoteBody(world.server, {
        id: 'n1',
        body: 'v2-silent',
        notify: false,
      });
      await world.runFor(400);
      await expectLiveNote(world.server.db, 'n1', { body: 'v2-silent' });
      await expectLiveNote(b.db, 'n1', { body: 'v1' });

      await pump(world, b.engine.refreshQueries());
      await expectLiveNote(b.db, 'n1', { body: 'v2-silent' });
      await world.assertConverged();
      await expectLiveNote(a.db, 'n1', { body: 'v2-silent' });
    } finally {
      await world.dispose();
    }
  });

  test('seed sweep silent write heals on sweep', async () => {
    for (const seed of [1091, 1092, 1093] as const) {
      const world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        faults: RELIABLE_FAULTS,
      });
      try {
        const a = await world.addClient({ id: 'alice' });
        const b = await world.addClient({ id: 'bob' });
        await a.mutate(setNote, { id: `n-${seed}`, body: 'old' });
        await world.assertConverged();
        await writeNoteBody(world.server, {
          id: `n-${seed}`,
          body: 'new',
          notify: false,
        });
        await pump(world, b.engine.refreshQueries());
        await pump(world, a.engine.refreshQueries());
        await world.assertConverged();
        await expectLiveNote(b.db, `n-${seed}`, { body: 'new' });
      } finally {
        await world.dispose();
      }
    }
  });
});
