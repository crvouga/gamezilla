/** Wait for the answer to the actual save, including when its first answer was lost. */

import {
  auth,
  connect,
  httpFault,
  lastMutationId,
  nudge,
  outcome,
  partition,
  restart,
  resumeNetwork,
} from '@pkgs/sync-engine/harness';
import { settledWrite, writeNote } from './note-writes';
import { app, type Device, ensureDevice, Given, When } from './world';

const CONFIRM_MS = 120_000;

Given(
  '{actor} is waiting to hear back about the note {string} saying {string}',
  async (w, actor: string, title: string, body: string) => {
    const device = app(actor);
    const person = await ensureDevice(w, device);
    await w.s.apply(httpFault, person, { kind: 'dropMutationsResponse' });
    await writeNote(w, device, { title, body });
    await settledWrite(w, device, { title, deleted: false });
    await w.s.apply(partition, person, 'sync');
  }
);

When('{device} hears back about its last save', async (w, device: Device) => {
  const person = await ensureDevice(w, device);
  const id = await w.s.read(lastMutationId, person);
  if (id === null) throw new Error(`${person} made no save`);
  await w.s.apply(resumeNetwork, person, 'sync');
  await w.s.until((s) => outcome(s, person, id), {
    maxMs: CONFIRM_MS,
    pred: (value) => value === 'confirmed',
  });
});

Given('{device} has been signed out elsewhere', async (w, device: Device) => {
  await w.s.apply(auth, await ensureDevice(w, device), 'revoked');
});

When('{device} signs back in', async (w, device: Device) => {
  const person = await ensureDevice(w, device);
  await w.s.apply(resumeNetwork, person, 'sync');
  await w.s.apply(connect, person);
  await w.s.apply(nudge, person).catch(() => undefined);
  await w.s.advanceTime(5_000);
  await w.s.apply(restart, person, { preserveLocalDb: true });
  w.offline.set(device, false);
});
