import { describe, expect, test } from 'bun:test';
import type { Script } from '@pkgs/dst';
import {
  acmeSystem,
  addClient,
  mutate,
  NOTES_AUTH_GATE_FOLDER_ID,
  nudge,
  type SyncSurface,
  setFolder,
  setNote,
} from '../apps/acme';
import {
  expectLiveNoteAt,
  expectNoteNotLiveAt,
  isNoteLiveAt,
  liveNotes,
} from '../apps/acme/reads';

const OWNED_SESSION = { name: 'notesOwned', params: {} };

/**
 * Nudge `clientId` across a negative window: every refresh must keep denying
 * the row. A plain `neverAcme` cannot re-authorize between polls.
 */
async function nudgeWhileDenied(
  s: Script<SyncSurface>,
  clientId: string,
  id: string,
  forMs: number
): Promise<void> {
  for (let waited = 0; waited <= forMs; waited += 25) {
    await s.apply(nudge, clientId);
    expect(await isNoteLiveAt(s, clientId, id)).toBe(false);
  }
}

describe('cross tenant rows never hydrate', () => {
  test('denied notesOwned peer never hydrates owner private rows', async () => {
    // rowImageFanout false: authorize deny must not be bypassed by images.
    await using s = await acmeSystem.script({
      seed: 980,
      args: { clientCount: 0, rowImageFanout: false },
    });

    await s.apply(addClient, {
      id: 'alice',
      actorId: 'alice',
      sessionQuery: OWNED_SESSION,
    });
    await s.apply(addClient, {
      id: 'bob',
      actorId: 'bob',
      sessionQuery: OWNED_SESSION,
    });

    await s.apply(mutate, 'alice', setFolder, {
      id: NOTES_AUTH_GATE_FOLDER_ID,
      title: 'alice-gate',
    });
    // Re-authorize after the gate folder lands.
    await s.apply(nudge, 'alice');
    await s.apply(mutate, 'alice', setNote, {
      id: 'alice-private',
      body: 'secret-a',
    });
    await nudgeWhileDenied(s, 'bob', 'alice-private', 400);

    await expectLiveNoteAt(s, 'alice', 'alice-private', {
      body: 'secret-a',
    });
    // Bob never owns the gate → notesOwned denied → no hydrate of alice rows.
    await expectNoteNotLiveAt(s, 'bob', 'alice-private');
    const bobNotes = await s.observe(liveNotes, 'bob');
    expect(bobNotes.some((n) => n.ownerId === 'alice')).toBe(false);
    expect(bobNotes.length).toBe(0);
  });

  test.each([981, 982, 983])(
    'seed sweep authorize filter keeps stranger rows out (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed,
        args: { clientCount: 0, rowImageFanout: false },
      });

      await s.apply(addClient, {
        id: 'alice',
        actorId: 'alice',
        sessionQuery: OWNED_SESSION,
      });
      await s.apply(addClient, {
        id: 'stranger',
        actorId: 'stranger',
        sessionQuery: OWNED_SESSION,
      });
      await s.apply(mutate, 'alice', setFolder, {
        id: NOTES_AUTH_GATE_FOLDER_ID,
        title: 'g',
      });
      await s.apply(mutate, 'alice', setNote, {
        id: `priv-${seed}`,
        body: 'x',
      });
      await nudgeWhileDenied(s, 'stranger', `priv-${seed}`, 300);
      await expectNoteNotLiveAt(s, 'stranger', `priv-${seed}`);
    }
  );
});
