/**
 * App updates and connections: people using the app, slow connections, the
 * app moving to another version (a local schema variant, kept on disk), and
 * how quickly a note arrives.
 */

import { expect } from 'bun:test';
import { notesAllWithColorQuery } from '@pkgs/sync-engine-harness/hardening-fixtures';
import {
  colourNote,
  noteTags,
  tagNote,
} from '@pkgs/sync-engine-harness/note-details';
import { liveNote, noteColor } from '@pkgs/sync-engine-harness/reads';
import { subscribe } from '@pkgs/sync-engine-harness/regression-actions';
import {
  netSet,
  restartWithSchema,
} from '@pkgs/sync-engine-harness/regression-random-faults-actions';
import {
  clock,
  connection,
  lastError,
  liveReconnects,
} from '@pkgs/sync-engine-harness/sync-observations';
import { SETTLE_MS, writeNote } from './note-writes';
import type { Device, SyncWorld } from './world';
import { app, clientId, ensureDevice, Given, Then, When } from './world';

/** Slow but lossless: 60 ms ± 40 ms each way on every channel. */
const SLOW = {
  latencyMeanMs: 60,
  latencyJitterMs: 40,
  dropProbability: 0,
  packetReplayProbability: 0,
  reorderWindow: 0,
  partitionProbability: 0,
  healProbability: 0,
} as const;

/** "Within a quarter of a second", checked every few milliseconds of the run's clock. */
const QUARTER_SECOND_MS = 250;
const FIFTH_OF_A_SECOND_MS = 200;
const QUICK_STEP_MS = 5;
/** Past this a note has not arrived at all (not merely late). */
const ARRIVAL_GIVE_UP_MS = 2_000;

Given('{actor} and {actor} use the app', async (w, a: string, b: string) => {
  await ensureDevice(w, app(a));
  await ensureDevice(w, app(b));
});

Given(
  '{actor} and {actor} have slow connections',
  async (w, a: string, b: string) => {
    for (const actor of [a, b]) {
      const id = await ensureDevice(w, app(actor));
      await w.s.apply(netSet, id, 'live', SLOW);
      await w.s.apply(netSet, id, 'sync', SLOW);
    }
  }
);

Then(
  '{actor} sees the note {string} within a quarter of a second',
  async (w, actor: string, title: string) => {
    const row = await w.s.until((s) => liveNote(s, actor, title), {
      maxMs: QUARTER_SECOND_MS,
      stepMs: QUICK_STEP_MS,
      pred: (r) => r !== null && r.deletedAt === null,
    });
    expect(row).toMatchObject({ title, deletedAt: null });
  }
);

async function moveTo(
  w: SyncWorld,
  device: Device,
  variant: string
): Promise<void> {
  const id = await ensureDevice(w, device);
  await w.s.apply(restartWithSchema, id, variant);
}

When(
  '{device} updates to a version that fetches every note again',
  (w, device: Device) => moveTo(w, device, 'epochBump')
);

Given(
  '{device} has updated to a version that gives notes a colour',
  (w, device: Device) => moveTo(w, device, 'extraColumn')
);

Given(
  '{device} has updated to a version that tags notes',
  (w, device: Device) => moveTo(w, device, 'extraTable')
);

When('{device} goes back to the earlier version', (w, device: Device) =>
  moveTo(w, device, 'baseline')
);

Then('{device} is still connected', async (w, device: Device) => {
  const id = await ensureDevice(w, device);
  const state = await w.s.until((s) => connection(s, id), {
    maxMs: SETTLE_MS,
    pred: (c) => c === 'connected',
  });
  expect(state).toBe('connected');
  expect(await w.s.read(lastError, id)).toBeNull();
  // Still: it never had to reconnect since it opened.
  expect(await w.s.read(liveReconnects, id)).toBe(0);
});

/**
 * One after another: each note is written once the one before has reached
 * everyone else in the writer's shared space, and how long each took to
 * reach each of them is noted for the `Then`.
 */
When(
  '{actor} writes {int} notes one after another',
  async (w, actor: string, count: number) => {
    const others = [...w.spaceOf.keys()].filter((p) => p !== actor);
    for (let i = 0; i < count; i += 1) {
      const title = `${actor}-note-${String(i)}`;
      const writtenAt = await w.s.read(clock);
      await writeNote(w, app(actor), { title, body: title });
      for (const other of others) {
        await w.s.until((s) => liveNote(s, other, title), {
          maxMs: ARRIVAL_GIVE_UP_MS,
          stepMs: QUICK_STEP_MS,
          pred: (row) => row !== null,
        });
        const arrivals = w.arrivalsMs.get(other) ?? [];
        arrivals.push((await w.s.read(clock)) - writtenAt);
        w.arrivalsMs.set(other, arrivals);
      }
    }
  }
);

Then(
  'at least {int} of the {int} notes reach {actor} within a fifth of a second each',
  (w, least: number, count: number, actor: string) => {
    const arrivals = w.arrivalsMs.get(actor) ?? [];
    expect(arrivals).toHaveLength(count);
    // Not vacuous: the slow connections did slow something down.
    expect(arrivals.some((ms) => ms > 0)).toBe(true);
    const quick = arrivals.filter((ms) => ms <= FIFTH_OF_A_SECOND_MS);
    expect(quick.length).toBeGreaterThanOrEqual(least);
  }
);

// --- colours and tags a newer version gives notes --------------------------

Given('{device} is on a version without colours', async (w, device: Device) => {
  await ensureDevice(w, device);
});

Given('{device} is still on the earlier version', async (w, device: Device) => {
  await ensureDevice(w, device);
});

Given(
  '{actor} has given the note {string} the colour {word}',
  async (w, actor: string, title: string, colour: string) => {
    const id = await ensureDevice(w, app(actor));
    await w.s.apply(colourNote, id, title, colour);
  }
);

Given(
  '{actor} has given the note {string} the tag {string}',
  async (w, actor: string, title: string, tag: string) => {
    const id = await ensureDevice(w, app(actor));
    await w.s.apply(tagNote, id, title, tag);
  }
);

/** The team runs the version with colours, and colours the note there. */
Given(
  'the team has given the note {string} the colour {word}',
  async (w, title: string, colour: string) => {
    await w.s.apply(restartWithSchema, 'server', 'extraColumn');
    await w.s.apply(colourNote, 'server', title, colour);
  }
);

/** The version with colours also fetches them. */
When(
  '{device} updates to a version that gives notes a colour',
  async (w, device: Device) => {
    await moveTo(w, device, 'extraColumn');
    await w.s.apply(
      subscribe,
      clientId(device),
      notesAllWithColorQuery.name,
      {}
    );
  }
);

When(
  '{device} updates to the version that gives notes a colour once more',
  (w, device: Device) => moveTo(w, device, 'extraColumn')
);

When(
  '{device} updates to the version that tags notes once more',
  (w, device: Device) => moveTo(w, device, 'extraTable')
);

Then(
  '{actor} sees the note {string} coloured {word}',
  async (w, actor: string, title: string, colour: string) => {
    const id = await ensureDevice(w, app(actor));
    const found = await w.s.until((s) => noteColor(s, id, title), {
      maxMs: SETTLE_MS,
      pred: (rows) => rows[0]?.color === colour,
    });
    expect(found).toEqual([{ color: colour }]);
  }
);

Then(
  '{actor} sees the note {string} tagged {string}',
  async (w, actor: string, title: string, tag: string) => {
    const id = await ensureDevice(w, app(actor));
    expect(await w.s.read(noteTags, id, title)).toEqual([tag]);
  }
);
