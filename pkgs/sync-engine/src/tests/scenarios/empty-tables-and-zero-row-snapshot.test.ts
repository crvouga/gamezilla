import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  notesDomainPack,
  readLiveFolders,
  readLiveNotes,
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

describe('empty tables and zero row snapshot', () => {
  test('zero-row world converges; not_modified refresh stays empty', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 1020,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await world.assertConverged();
      expect(await readLiveNotes(a.db)).toEqual([]);
      expect(await readLiveFolders(a.db)).toEqual([]);
      expect(await readLiveNotes(b.db)).toEqual([]);

      await pump(world, a.engine.refreshQueries());
      await pump(world, b.engine.refreshQueries());
      expect(await readLiveNotes(a.db)).toEqual([]);
      await world.assertConverged();
    } finally {
      await world.dispose();
    }
  });

  test('absence in snapshot does not delete unrelated live rows outside scope', async () => {
    // Pin upsert contract: empty secondary scope refresh must not wipe domain.
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 1021,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'keep', body: 'seed' });
      await world.assertConverged();

      const denied = a.engine.subscribeQuery('notesDenied', {});
      await pump(world, denied.waitForFirstSync());
      await expectLiveNote(a.db, 'keep', { body: 'seed' });
      denied.unsubscribe();
      await pump(world, a.engine.refreshQueries());
      await expectLiveNote(a.db, 'keep', { body: 'seed' });
      await world.assertConverged();
    } finally {
      await world.dispose();
    }
  });

  test('seed sweep empty converge', async () => {
    for (const seed of [1022, 1023, 1024] as const) {
      const world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        faults: RELIABLE_FAULTS,
      });
      try {
        await world.addClient({ id: 'alice' });
        await world.addClient({ id: 'bob' });
        await world.assertConverged();
        expect(await readLiveNotes(world.server.db)).toEqual([]);
      } finally {
        await world.dispose();
      }
    }
  });
});
