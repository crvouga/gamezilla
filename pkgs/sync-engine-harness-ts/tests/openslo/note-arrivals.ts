/**
 * The product adapter for `specs/sync-engine/note-delivery.openslo.yaml`:
 * one `exampleSystem` run (pinned seed, virtual clock) in which three people
 * share a space over the slow connections of "Notes arrive quickly" (60 ms ±
 * 40 ms each way, lossless) and take turns writing notes, one after another.
 * Every note yields one sample per other person: how long, on the run's
 * clock, from the write until the note shows on that person's device.
 */

import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import {
  createSpace,
  joinSpace,
  setSpaceNote,
} from '@pkgs/sync-engine-harness-ts/membership-mutations';
import { SPACE_MEMBERSHIP_SESSION } from '@pkgs/sync-engine-harness-ts/membership-query';
import { hasTopic, liveNote } from '@pkgs/sync-engine-harness-ts/reads';
import {
  addClient,
  mutate,
} from '@pkgs/sync-engine-harness-ts/regression-actions';
import { netSet } from '@pkgs/sync-engine-harness-ts/regression-random-faults-actions';
import type { SyncHarness } from '@pkgs/sync-engine-harness-ts/scenario-system';
import {
  clock,
  subscribedTopics,
} from '@pkgs/sync-engine-harness-ts/sync-observations';
import { roomTopic } from '@pkgs/sync-engine-harness-ts/topics';

/** The same network model as "Notes arrive quickly". */
const SLOW = {
  latencyMeanMs: 60,
  latencyJitterMs: 40,
  dropProbability: 0,
  packetReplayProbability: 0,
  reorderWindow: 0,
  partitionProbability: 0,
  healProbability: 0,
} as const;

const PEOPLE = ['alice', 'bob', 'carol'] as const;
const SPACE = 'trip';
/** Notes written in turn; each gives one sample per other person. */
const NOTE_COUNT = 100;
/** How often the other devices are looked at, on the run's clock. */
const POLL_MS = 5;
/** Past this a note has not arrived at all; it counts as this slow. */
const GIVE_UP_MS = 2_000;
const SETTLE_MS = 15_000;

export type Arrival = {
  /** When the note was written, on the run's clock. */
  readonly writtenAtMs: number;
  /** How long it took to show on one other person's device. */
  readonly tookMs: number;
};

async function inSpace(s: Run<SyncHarness>, person: string): Promise<void> {
  await s.until((h) => subscribedTopics(h, person), {
    maxMs: SETTLE_MS,
    pred: hasTopic(roomTopic(SPACE)),
  });
}

/** Everyone in the shared space, every connection slow. */
async function shareSpace(s: Run<SyncHarness>): Promise<void> {
  for (const person of PEOPLE) {
    await s.apply(addClient, {
      id: person,
      actorId: person,
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });
  }
  const [host, ...guests] = PEOPLE;
  await s.apply(mutate, host, createSpace, { id: SPACE, title: SPACE });
  await inSpace(s, host);
  for (const guest of guests) {
    await s.apply(mutate, guest, joinSpace, { spaceId: SPACE });
    await inSpace(s, guest);
  }
  for (const person of PEOPLE) {
    await s.apply(netSet, person, 'live', SLOW);
    await s.apply(netSet, person, 'sync', SLOW);
  }
}

/** How long the note took to show on each of `others`, polled together. */
async function arrivalTimes(
  s: Run<SyncHarness>,
  note: { readonly id: string; readonly writtenAtMs: number },
  others: readonly string[]
): Promise<readonly number[]> {
  const took = new Map<string, number>();
  for (;;) {
    const elapsed = (await s.read(clock)) - note.writtenAtMs;
    for (const other of others) {
      if (took.has(other)) continue;
      if ((await s.read(liveNote, other, note.id)) !== null) {
        took.set(other, elapsed);
      }
    }
    if (took.size === others.length || elapsed >= GIVE_UP_MS) break;
    await s.advanceTime(POLL_MS);
  }
  return others.map((other) => took.get(other) ?? GIVE_UP_MS);
}

async function writeInTurn(
  s: Run<SyncHarness>,
  index: number
): Promise<readonly Arrival[]> {
  const writer = PEOPLE[index % PEOPLE.length] ?? PEOPLE[0];
  const id = `note-${String(index)}`;
  const writtenAtMs = await s.read(clock);
  await s.apply(mutate, writer, setSpaceNote, {
    id,
    spaceId: SPACE,
    title: id,
    body: id,
  });
  const others = PEOPLE.filter((person) => person !== writer);
  const times = await arrivalTimes(s, { id, writtenAtMs }, others);
  return times.map((tookMs) => ({ writtenAtMs, tookMs }));
}

/** Every note's arrival at every other person, in the order written. */
export async function noteArrivals(
  open: () => Promise<Run<SyncHarness>>
): Promise<{ readonly arrivals: readonly Arrival[]; readonly endMs: number }> {
  await using s = await open();
  await shareSpace(s);
  const arrivals: Arrival[] = [];
  for (let i = 0; i < NOTE_COUNT; i += 1) {
    arrivals.push(...(await writeInTurn(s, i)));
  }
  return { arrivals, endMs: await s.read(clock) };
}
