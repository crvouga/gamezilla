/**
 * Devices: going offline and back, crashing, reopening, a lost save reply,
 * and a person using more than one device.
 */

import { expect } from 'bun:test';
import { liveNotes } from '@pkgs/sync-engine-harness/reads';
import {
  clearLocalData,
  connect,
  disconnect,
  online,
} from '@pkgs/sync-engine-harness/regression-actions';
import {
  crash,
  net,
  restart,
} from '@pkgs/sync-engine-harness/regression-random-faults-actions';
import { settledWrite, writeNote } from './note-writes';
import type { Device } from './world';
import { ensureDevice, Given, Then, When } from './world';

const SETTLE_MS = 15_000;

Given(
  '{actor} uses the app on a phone and a tablet',
  async (w, actor: string) => {
    await ensureDevice(w, { actor, kind: 'phone' });
    await ensureDevice(w, { actor, kind: 'tablet' });
  }
);

/** Offline: no network, and the app knows it (online-only actions refuse). */
Given('{device} is offline', async (w, device: Device) => {
  const id = await ensureDevice(w, device);
  await w.s.apply(online, id, false);
  await w.s.apply(disconnect, id);
  w.offline.set(device, true);
});

/**
 * Cannot send: its requests to the server go nowhere (held, not refused),
 * while live updates still reach it.
 */
Given('{device} cannot send', async (w, device: Device) => {
  const id = await ensureDevice(w, device);
  await w.s.apply(net, id, 'sync', 'hold');
});

When('{device} comes back online', async (w, device: Device) => {
  const id = await ensureDevice(w, device);
  await w.s.apply(connect, id);
  await w.s.apply(online, id, true);
  w.offline.set(device, false);
});

Given('{device} has come back online', async (w, device: Device) => {
  const id = await ensureDevice(w, device);
  await w.s.apply(connect, id);
  await w.s.apply(online, id, true);
  w.offline.set(device, false);
});

/** Closing keeps the device's on-disk database; so does a crash. */
When('{device} closes and reopens', async (w, device: Device) => {
  const id = await ensureDevice(w, device);
  await w.s.apply(restart, id, { preserveLocalDb: true });
});

When('{device} has its data cleared', async (w, device: Device) => {
  const id = await ensureDevice(w, device);
  await w.s.apply(clearLocalData, id, 'cleared');
});

When('{device} crashes and reopens', async (w, device: Device) => {
  const id = await ensureDevice(w, device);
  await w.s.apply(crash, id);
  await w.s.apply(restart, id, { preserveLocalDb: true });
});

Given('{device} has crashed and reopened', async (w, device: Device) => {
  const id = await ensureDevice(w, device);
  await w.s.apply(crash, id);
  await w.s.apply(restart, id, { preserveLocalDb: true });
});

Given(
  '{actor} has written the note {string} on their {deviceKind}',
  async (w, actor: string, title: string, kind: string) => {
    await writeNote(w, { actor, kind }, { title, body: '' });
    await settledWrite(w, { actor, kind }, { title, deleted: false });
  }
);

Then(
  '{device} shows the notes {string} and {string}',
  async (w, device: Device, first: string, second: string) => {
    const id = await ensureDevice(w, device);
    const ids = await w.s.until(
      async (s) => (await liveNotes(s, id)).map((row) => row.id),
      {
        maxMs: SETTLE_MS,
        pred: (seen) => seen.includes(first) && seen.includes(second),
      }
    );
    expect(ids).toEqual(expect.arrayContaining([first, second]));
  }
);
