import { describe, expect, test } from 'bun:test';
import { defineAction } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';
import fc from 'fast-check';

import {
  acmeSystem,
  clientIds,
  deleteNote,
  expectConverged,
  expectNoteNotLiveAt,
  liveNote,
  mutate,
  readNoteTombstoneAt,
  type SyncSurface,
  setNote,
} from '../apps/acme';

const NOTE_ID = 'n0';

/** c0 sets `n0` to one of two bodies — the slice the tombstone walk draws from. */
const setBody = defineAction<SyncSurface, [string]>({
  name: 'setBody',
  draw: () => gen(fc.constantFrom('a', 'b')),
  act: async (s, body) => {
    const client = s.clients.get('c0');
    if (client === undefined) throw new Error('c0 missing');
    await client.mutate(setNote, { id: NOTE_ID, body, title: '' });
  },
});

/** c0 soft-deletes `n0`; a delete before any set is a no-op on the model. */
const del = defineAction<SyncSurface>({
  name: 'del',
  act: async (s) => {
    const client = s.clients.get('c0');
    if (client === undefined) throw new Error('c0 missing');
    await client.mutate(deleteNote, { id: NOTE_ID });
  },
});

type Expected = {
  readonly everSet: boolean;
  readonly deleted: boolean;
  readonly lastBody: string;
};

/** Fold the recorded walk transitions into the expected final note state. */
function expectedFrom(
  transitions: readonly { action: { name: string; args: readonly unknown[] } }[]
): Expected {
  let everSet = false;
  let deleted = false;
  let lastBody = '';
  for (const { action } of transitions) {
    if (action.name === 'setBody') {
      everSet = true;
      deleted = false;
      lastBody = String(action.args[0]);
    } else if (action.name === 'del' && everSet) {
      deleted = true;
    }
  }
  return { everSet, deleted, lastBody };
}

describe('tombstone revive PBT', () => {
  test(
    'set/delete interleave converges with consistent live vs tombstone state',
    async () => {
      for (const seed of [701, 702, 703, 704, 705, 706]) {
        await using s = await acmeSystem.script({
          seed,
          args: { rowImageFanout: seed % 2 === 0 },
        });
        const walk = await s.walk({
          actions: [setBody, del],
          steps: 1 + (seed % 8),
        });
        const want = expectedFrom(walk.transitions);

        await expectConverged(s);
        if (!want.everSet) continue;

        const tomb = await readNoteTombstoneAt(s, 'server', NOTE_ID);
        if (want.deleted) {
          expect(tomb).not.toBeNull();
          await expectNoteNotLiveAt(s, 'c0', NOTE_ID);
        } else {
          expect(tomb).toBeNull();
          expect(await s.observe(liveNote, 'c0', NOTE_ID)).toMatchObject({
            body: want.lastBody,
          });
        }
      }
    },
    { timeout: 90_000 }
  );

  test(
    'revive after delete restores live row on all clients',
    async () => {
      for (const [i, [body1, body2]] of [
        ['first', 'second'],
        ['', 'x'],
        ['same', 'same'],
      ].entries()) {
        await using s = await acmeSystem.script({
          seed: 720 + i,
          args: { clientCount: 3, liveResendOnReconnect: i === 1 },
        });
        await s.apply(mutate, 'c0', setNote, {
          id: NOTE_ID,
          body: body1,
          title: '',
        });
        await s.apply(mutate, 'c0', deleteNote, { id: NOTE_ID });
        await s.apply(mutate, 'c0', setNote, {
          id: NOTE_ID,
          body: body2,
          title: '',
        });
        await expectConverged(s);
        for (const peer of await s.observe(clientIds)) {
          expect(await s.observe(liveNote, peer, NOTE_ID)).toMatchObject({
            body: body2,
          });
        }
      }
    },
    { timeout: 90_000 }
  );
});
