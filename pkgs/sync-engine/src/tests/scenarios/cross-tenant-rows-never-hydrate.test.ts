import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  expectNoteNotLive,
  NOTES_AUTH_GATE_FOLDER_ID,
  notesDomainPack,
  readLiveNotes,
  setFolder,
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

describe('cross tenant rows never hydrate', () => {
  test('denied notesOwned peer never hydrates owner private rows', async () => {
    // rowImageFanout false: authorize deny must not be bypassed by images.
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 980,
      faults: RELIABLE_FAULTS,
      rowImageFanout: false,
    });
    try {
      const a = await world.addClient({
        id: 'alice',
        actorId: 'alice',
        sessionQuery: { name: 'notesOwned', params: {} },
      });
      const b = await world.addClient({
        id: 'bob',
        actorId: 'bob',
        sessionQuery: { name: 'notesOwned', params: {} },
      });

      await a.mutate(setFolder, {
        id: NOTES_AUTH_GATE_FOLDER_ID,
        title: 'alice-gate',
      });
      await pump(world, a.engine.refreshQueries());
      await a.mutate(setNote, { id: 'alice-private', body: 'secret-a' });
      await world.runFor(400);
      await pump(world, b.engine.refreshQueries());

      await expectLiveNote(a.db, 'alice-private', { body: 'secret-a' });
      // Bob never owns the gate → notesOwned denied → no hydrate of alice rows.
      await expectNoteNotLive(b.db, 'alice-private');
      expect(
        (await readLiveNotes(b.db)).some((n) => n.owner_id === 'alice')
      ).toBe(false);
      expect((await readLiveNotes(b.db)).length).toBe(0);
    } finally {
      await world.dispose();
    }
  });

  test('seed sweep authorize filter keeps stranger rows out', async () => {
    for (const seed of [981, 982, 983] as const) {
      const world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        faults: RELIABLE_FAULTS,
        rowImageFanout: false,
      });
      try {
        const a = await world.addClient({
          id: 'alice',
          sessionQuery: { name: 'notesOwned', params: {} },
        });
        const stranger = await world.addClient({
          id: 'stranger',
          sessionQuery: { name: 'notesOwned', params: {} },
        });
        await a.mutate(setFolder, {
          id: NOTES_AUTH_GATE_FOLDER_ID,
          title: 'g',
        });
        await a.mutate(setNote, { id: `priv-${seed}`, body: 'x' });
        await world.runFor(300);
        await pump(world, stranger.engine.refreshQueries());
        await expectNoteNotLive(stranger.db, `priv-${seed}`);
      } finally {
        await world.dispose();
      }
    }
  });
});
