import { describe, expect, test } from 'bun:test';
import type { Run } from '@pkgs/dst';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  mutate,
  NOTES_AUTH_GATE_FOLDER_ID,
  nudge,
  type SyncSurface,
  setFolder,
  setNote,
  syncVirtualHost,
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
  run: Run<SyncSurface>,
  clientId: string,
  id: string,
  forMs: number
): Promise<void> {
  for (let waited = 0; waited <= forMs; waited += 25) {
    await run.apply(nudge, clientId);
    expect(await isNoteLiveAt(run, clientId, id)).toBe(false);
  }
}

describe('cross tenant rows never hydrate', () => {
  test('denied notesOwned peer never hydrates owner private rows', async () => {
    // rowImageFanout false: authorize deny must not be bypassed by images.
    await using run = await script(acmeSystem, {
      seed: 980,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0, rowImageFanout: false }),
      properties: [],
    });

    await run.apply(addClient, {
      id: 'alice',
      actorId: 'alice',
      sessionQuery: OWNED_SESSION,
    });
    await run.apply(addClient, {
      id: 'bob',
      actorId: 'bob',
      sessionQuery: OWNED_SESSION,
    });

    await run.apply(mutate, 'alice', setFolder, {
      id: NOTES_AUTH_GATE_FOLDER_ID,
      title: 'alice-gate',
    });
    // Re-authorize after the gate folder lands.
    await run.apply(nudge, 'alice');
    await run.apply(mutate, 'alice', setNote, {
      id: 'alice-private',
      body: 'secret-a',
    });
    await nudgeWhileDenied(run, 'bob', 'alice-private', 400);

    await expectLiveNoteAt(run, 'alice', 'alice-private', {
      body: 'secret-a',
    });
    // Bob never owns the gate → notesOwned denied → no hydrate of alice rows.
    await expectNoteNotLiveAt(run, 'bob', 'alice-private');
    const bobNotes = await run.observe(liveNotes('bob'));
    expect(bobNotes.some((n) => n.ownerId === 'alice')).toBe(false);
    expect(bobNotes.length).toBe(0);
  });

  test.each([981, 982, 983])(
    'seed sweep authorize filter keeps stranger rows out (seed=%i)',
    async (seed) => {
      await using run = await script(acmeSystem, {
        seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({ clientCount: 0, rowImageFanout: false }),
        properties: [],
      });

      await run.apply(addClient, {
        id: 'alice',
        actorId: 'alice',
        sessionQuery: OWNED_SESSION,
      });
      await run.apply(addClient, {
        id: 'stranger',
        actorId: 'stranger',
        sessionQuery: OWNED_SESSION,
      });
      await run.apply(mutate, 'alice', setFolder, {
        id: NOTES_AUTH_GATE_FOLDER_ID,
        title: 'g',
      });
      await run.apply(mutate, 'alice', setNote, {
        id: `priv-${seed}`,
        body: 'x',
      });
      await nudgeWhileDenied(run, 'stranger', `priv-${seed}`, 300);
      await expectNoteNotLiveAt(run, 'stranger', `priv-${seed}`);
    }
  );
});
