/**
 * Shared helpers for note steps (steps never call other steps). A note is
 * identified by its title; a person in a shared space writes into it.
 */

import { setSpaceNote } from '@pkgs/sync-engine-harness-ts/membership-mutations';
import {
  deleteNote,
  requiresOnlineNote,
  setNote,
} from '@pkgs/sync-engine-harness-ts/mutations';
import { liveNote } from '@pkgs/sync-engine-harness-ts/reads';
import { mutate } from '@pkgs/sync-engine-harness-ts/regression-actions';
import type { Device, SyncWorld } from './world';
import { ensureDevice } from './world';

/** How long a person would wait for a note to reach them. */
export const SETTLE_MS = 15_000;

export async function writeNote(
  w: SyncWorld,
  device: Device,
  note: { readonly title: string; readonly body: string }
): Promise<void> {
  const id = await ensureDevice(w, device);
  const { title, body } = note;
  const spaceId = w.spaceOf.get(device.actor);
  await (spaceId === undefined
    ? w.s.apply(mutate, id, setNote, { id: title, title, body })
    : w.s.apply(mutate, id, setSpaceNote, { id: title, spaceId, title, body }));
}

export async function removeNote(
  w: SyncWorld,
  device: Device,
  title: string
): Promise<void> {
  const id = await ensureDevice(w, device);
  await w.s.apply(mutate, id, deleteNote, { id: title });
}

export async function writeAnnouncement(
  w: SyncWorld,
  device: Device,
  note: { readonly title: string; readonly body: string }
): Promise<void> {
  const id = await ensureDevice(w, device);
  const spaceId = w.spaceOf.get(device.actor);
  await w.s.apply(mutate, id, requiresOnlineNote, {
    id: note.title,
    title: note.title,
    body: note.body,
    ...(spaceId === undefined ? {} : { spaceId }),
  });
}

/**
 * A `Given` fact is settled: an online device's write has reached everyone
 * (the shared copy holds it, live or deleted as written). An offline
 * device's write waits on the device.
 */
export async function settledWrite(
  w: SyncWorld,
  device: Device,
  note: { readonly title: string; readonly deleted: boolean }
): Promise<void> {
  if (w.offline.has(device)) return;
  await w.s.until((s) => liveNote(s, 'server', note.title), {
    maxMs: SETTLE_MS,
    pred: (row) => row !== null && (row.deletedAt !== null) === note.deleted,
  });
}
