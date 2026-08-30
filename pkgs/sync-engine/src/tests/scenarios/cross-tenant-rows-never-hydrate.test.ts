import { describe, expect, test } from 'bun:test';
import { openWorld } from '../../sim/world';
import {
  acmeDomainPack,
  expectLiveNote,
  expectNoteNotLive,
  isLiveNote,
  NOTES_AUTH_GATE_FOLDER_ID,
  readLiveNotes,
  setFolder,
  setNote,
} from '../apps/acme';

describe('cross tenant rows never hydrate', () => {
  test('denied notesOwned peer never hydrates owner private rows', async () => {
    // rowImageFanout false: authorize deny must not be bypassed by images.
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 980,
      rowImageFanout: false,
    });
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
    // nudge: re-authorize after gate folder
    await world.until(a.nudge());
    await a.mutate(setNote, { id: 'alice-private', body: 'secret-a' });
    await world.never(
      async () => {
        // nudge: stranger refresh must still deny across the negative window
        await b.nudge();
        return isLiveNote(b.db, 'alice-private');
      },
      { forMs: 400 }
    );

    await expectLiveNote(a.db, 'alice-private', { body: 'secret-a' });
    // Bob never owns the gate → notesOwned denied → no hydrate of alice rows.
    await expectNoteNotLive(b.db, 'alice-private');
    expect(
      (await readLiveNotes(b.db)).some((n) => n.owner_id === 'alice')
    ).toBe(false);
    expect((await readLiveNotes(b.db)).length).toBe(0);
  });

  test.each([981, 982, 983])(
    'seed sweep authorize filter keeps stranger rows out (seed=%i)',
    async (seed) => {
      await using world = await openWorld({
        domain: acmeDomainPack,
        seed,
        rowImageFanout: false,
      });
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
      await world.never(
        async () => {
          // nudge: stranger refresh must still deny across the negative window
          await stranger.nudge();
          return isLiveNote(stranger.db, `priv-${seed}`);
        },
        { forMs: 300 }
      );
      await expectNoteNotLive(stranger.db, `priv-${seed}`);
    }
  );
});
