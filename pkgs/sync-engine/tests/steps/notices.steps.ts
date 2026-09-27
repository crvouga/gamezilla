/**
 * Notices of refused edits: a write the device accepted that the rules
 * refuse once it reaches everyone else.
 */

import { expect } from 'bun:test';
import {
  acknowledgeWriteRejectionMutation,
  connect,
  disconnect,
  mutate,
  rejections,
} from '@pkgs/sync-engine/sim';
import { removeNote, SETTLE_MS, settledWrite, writeNote } from './note-writes';
import { app, ensureDevice, Given, Then, When } from './world';

/**
 * The refusal as it happens: the person writes the note (owning it), deletes
 * it offline, someone else in their space takes the note over meanwhile, and
 * the delete is refused once the person is back online.
 */
Given(
  '{actor} has been refused deleting the note {string}',
  async (w, actor: string, title: string) => {
    const other = [...w.spaceOf.keys()].find((person) => person !== actor);
    if (other === undefined) throw new Error(`${actor} shares no space`);
    const id = await ensureDevice(w, app(actor));
    await writeNote(w, app(actor), { title, body: 'mine' });
    await settledWrite(w, app(actor), { title, deleted: false });
    await w.s.apply(disconnect, id);
    await removeNote(w, app(actor), title);
    await writeNote(w, app(other), { title, body: 'theirs' });
    await settledWrite(w, app(other), { title, deleted: false });
    await w.s.apply(connect, id);
    await w.s.until((s) => rejections(s, actor), {
      maxMs: SETTLE_MS,
      pred: (list) => list.length > 0,
    });
  }
);

When(
  '{actor} acknowledges the notice about the note {string}',
  async (w, actor: string, _title: string) => {
    const [notice] = await w.s.read(rejections, actor);
    if (notice === undefined) throw new Error(`${actor} has no notice`);
    await w.s.apply(mutate, actor, acknowledgeWriteRejectionMutation, {
      rejectionId: notice.id,
    });
  }
);

Then(
  '{actor} has a notice that deleting the note {string} was refused',
  async (w, actor: string, _title: string) => {
    const list = await w.s.until((s) => rejections(s, actor), {
      maxMs: SETTLE_MS,
      pred: (found) => found.length > 0,
    });
    expect(list.map((notice) => notice.code)).toEqual(['FORBIDDEN']);
  }
);

Then('{actor} has no notices', async (w, actor: string) => {
  const list = await w.s.until((s) => rejections(s, actor), {
    maxMs: SETTLE_MS,
    pred: (found) => found.length === 0,
  });
  expect(list).toEqual([]);
});
