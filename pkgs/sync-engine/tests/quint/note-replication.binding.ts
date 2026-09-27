/**
 * Binds `specs/sync/note-replication.qnt` to `exampleSystem`: each model
 * action is one or a few `s.apply` calls with the values Quint drew, and
 * `observe` reads the model's observable variables (`notes`, `owners`,
 * `rejections`, `unsent`) back out of the sim.
 */

import { bindQuintModel, type Picks } from '@pkgs/quint/registry';
import type { SimHttpFault } from '@pkgs/sync-engine/sim';
import {
  addClient,
  addPeerEngine,
  auth,
  brokerCrash,
  brokerRestart,
  clearLocalData,
  clientIds,
  connect,
  crash,
  crashAt,
  deleteNote,
  disconnect,
  foreground,
  httpFault,
  lastMutationId,
  liveNotes,
  mutate,
  netSet,
  nudge,
  outcome,
  partition,
  pubsubFault,
  queuedEdits,
  rejections,
  restart,
  restartWithSchema,
  resumeNetwork,
  serverOp,
  setNote,
  skewClock,
  tamperLocalStorage,
} from '@pkgs/sync-engine/sim';
import type { NoteWorld } from './note-world';

const PEOPLE = ['alice', 'bob', 'carol'] as const;
const SHARED = 'shared';

/** A save that failed once is retried after request timeout + backoff. */
const RETRY_MAX_MS = 120_000;
/** How long an armed crash may take to fire once its save starts. */
const CRASH_MAX_MS = 15_000;
const DAY_MS = 86_400_000;

const LOSSY_LIVE = {
  dropProbability: 0.4,
  packetReplayProbability: 0.5,
  reorderWindow: 5,
  latencyMeanMs: 15,
  latencyJitterMs: 25,
} as const;

/** The model's versions → the example app's local schema variants. */
const VERSIONS: Readonly<Record<string, string>> = {
  first: 'baseline',
  colours: 'extraColumn',
  tags: 'extraTable',
  fresh: 'epochBump',
};

/** The model's hiccups → one-shot faults on the next save. */
const HICCUPS: Readonly<Record<string, SimHttpFault>> = {
  error: { kind: 'serverErrorOnNext', route: 'mutations' },
  slowDown: { kind: 'rateLimited', route: 'mutations', retryAfterMs: 2_000 },
  cutOff: { kind: 'abortResponseBody', route: 'mutations' },
  garbled: { kind: 'corruptMutationsResponse', variant: 'truncatedJson' },
  failedAfterKeeping: { kind: 'failMutationsAfterCommit' },
};

/** The model's hiccups → one-shot faults on the next refresh. */
const REFRESH_HICCUPS: Readonly<Record<string, SimHttpFault>> = {
  error: { kind: 'serverErrorOnNext', route: 'query' },
  slowDown: { kind: 'rateLimited', route: 'query', retryAfterMs: 1_000 },
  cutOff: { kind: 'abortResponseBody', route: 'query' },
  garbled: { kind: 'corruptQueryResponse', variant: 'garbageString' },
  failedAfterKeeping: { kind: 'dropQueryResponse' },
};

/**
 * Uneven delays on the save-and-refresh channel, so answers arrive out of
 * order. Nothing is lost or repeated (a lost request is a hiccup, which the
 * app waits out on its own clock; the network never repeats an answer).
 */
const FLAKY = {
  latencyMeanMs: 40,
  latencyJitterMs: 60,
  reorderWindow: 3,
} as const;

/** The model's damage → what is tampered in the device's storage. */
const DAMAGE: Readonly<
  Record<string, 'corruptCheckpoint' | 'flipDomainRow' | 'corruptLastHash'>
> = {
  progress: 'corruptCheckpoint',
  note: 'flipDomainRow',
  fingerprint: 'corruptLastHash',
};

/** The model's crash moments → the save event the crash is armed on. */
const MOMENTS: Readonly<Record<string, string>> = {
  afterWriting: 'afterNextMutateResolved',
  afterSending: 'afterNextMutationsPostAccepted',
};

const pick = (picks: Picks, name: string): string => String(picks[name]);

function lookup<T>(table: Readonly<Record<string, T>>, key: string): T {
  const value = table[key];
  if (value === undefined) throw new Error(`no binding for "${key}"`);
  return value;
}

const windowId = (person: string): string => `${person}-window`;

/** The person's device: its app, and its second window once opened. */
function windowsOf(w: NoteWorld, p: Picks): string[] {
  const person = pick(p, 'person');
  return w.windows.has(person) ? [person, windowId(person)] : [person];
}

async function liveNotesOf(w: NoteWorld, node: string) {
  const rows = await w.s.read(liveNotes, node);
  return {
    bodies: new Map(rows.map((row) => [row.id, row.body])),
    owners: new Map(rows.map((row) => [row.id, row.ownerId])),
  };
}

/**
 * Unsent edits: queued ones, less the write whose confirmation was lost —
 * the shared notes already have it, however soon the app retries.
 */
async function unsentOf(w: NoteWorld, person: string): Promise<number> {
  const ids = await w.s.read(queuedEdits, person);
  // Not running: no count the model can reach, so the step fails readably.
  if (ids === null) return -1;
  return ids.filter((id) => id !== w.owed.get(person)).length;
}

/** Write the drawn note and wait until the shared notes confirm it. */
async function writeConfirmed(w: NoteWorld, p: Picks): Promise<void> {
  const person = pick(p, 'person');
  await w.s.apply(mutate, person, setNote, {
    id: pick(p, 'title'),
    body: pick(p, 'body'),
  });
  const id = await w.s.read(lastMutationId, person);
  if (id === null) throw new Error(`${person} made no write`);
  await w.s.until((s) => outcome(s, person, id), {
    maxMs: RETRY_MAX_MS,
    pred: (v) => v === 'confirmed',
  });
}

bindQuintModel<NoteWorld>({
  model: 'note-replication',
  traces: 64,
  maxSteps: 16,
  actions: {
    init: async (w) => {
      for (const person of PEOPLE) await w.s.apply(addClient, person);
    },
    write: (w, p) =>
      w.s.apply(mutate, pick(p, 'person'), setNote, {
        id: pick(p, 'title'),
        body: pick(p, 'body'),
      }),
    deleteNote: (w, p) =>
      w.s.apply(mutate, pick(p, 'person'), deleteNote, {
        id: pick(p, 'title'),
      }),
    writeUnheard: async (w, p) => {
      const person = pick(p, 'person');
      await w.s.apply(httpFault, person, { kind: 'dropMutationsResponse' });
      await w.s.apply(mutate, person, setNote, {
        id: pick(p, 'title'),
        body: pick(p, 'body'),
      });
      const id = await w.s.read(lastMutationId, person);
      if (id !== null) w.owed.set(person, id);
    },
    hearBack: async (w, p) => {
      const person = pick(p, 'person');
      const id = w.owed.get(person);
      if (id === undefined) throw new Error(`${person} owes no retry`);
      w.owed.delete(person);
      await w.s.until((s) => outcome(s, person, id), {
        maxMs: RETRY_MAX_MS,
        pred: (v) => v === 'confirmed',
      });
    },
    writeThroughHiccup: async (w, p) => {
      await w.s.apply(
        httpFault,
        pick(p, 'person'),
        lookup(HICCUPS, pick(p, 'hiccup'))
      );
      await writeConfirmed(w, p);
    },
    goOffline: async (w, p) => {
      for (const id of windowsOf(w, p)) await w.s.apply(disconnect, id);
    },
    goOnline: async (w, p) => {
      for (const id of windowsOf(w, p)) await w.s.apply(connect, id);
    },
    // A stalled network carries nothing either way; the app finds out only
    // when its requests time out, and catches up on its own once it recovers.
    networkStalls: async (w, p) => {
      for (const id of windowsOf(w, p)) {
        await w.s.apply(partition, id, 'all');
      }
    },
    networkRecovers: async (w, p) => {
      for (const id of windowsOf(w, p)) {
        await w.s.apply(resumeNetwork, id, 'all');
      }
      await w.s.until((s) => queuedEdits(s, pick(p, 'person')), {
        maxMs: RETRY_MAX_MS,
        pred: (ids) => ids?.length === 0,
      });
    },
    crashAndReopen: async (w, p) => {
      // A crash keeps the device's on-disk database.
      await w.s.apply(crash, pick(p, 'person'));
      await w.s.apply(restart, pick(p, 'person'), { preserveLocalDb: true });
    },
    crashWhileSaving: async (w, p) => {
      const person = pick(p, 'person');
      await w.s.apply(crashAt, person, lookup(MOMENTS, pick(p, 'moment')));
      await w.s.apply(mutate, person, setNote, {
        id: pick(p, 'title'),
        body: pick(p, 'body'),
      });
      await w.s.until(clientIds, {
        maxMs: CRASH_MAX_MS,
        pred: (ids) => !ids.includes(person),
      });
      await w.s.apply(restart, person, { preserveLocalDb: true });
    },
    appUpdates: (w, p) =>
      w.s.apply(
        restartWithSchema,
        pick(p, 'person'),
        lookup(VERSIONS, pick(p, 'version'))
      ),
    appDataDamaged: async (w, p) => {
      const person = pick(p, 'person');
      await w.s.apply(
        tamperLocalStorage,
        person,
        lookup(DAMAGE, pick(p, 'damage'))
      );
      await w.s.apply(restart, person, { preserveLocalDb: true });
    },
    appDataCleared: (w, p) =>
      w.s.apply(clearLocalData, pick(p, 'person'), 'cleared'),
    clockIsWrong: (w, p) => w.s.apply(skewClock, pick(p, 'person'), DAY_MS),
    liveUpdatesDegrade: async (w, p) => {
      await w.s.apply(netSet, pick(p, 'person'), 'live', LOSSY_LIVE);
      await w.s.advanceTime(10);
    },
    liveUpdatesGarbled: async (w) => {
      await w.s.apply(pubsubFault, {
        kind: 'corruptPubsubPayload',
        variant: 'flipField',
      });
      await w.s.apply(pubsubFault, { kind: 'duplicatePublish', count: 1 });
    },
    liveUpdatesPause: async (w) => {
      await w.s.apply(brokerCrash);
      await w.s.advanceTime(500);
      await w.s.apply(brokerRestart);
    },
    outage: async (w) => {
      await w.s.apply(crash, 'server');
      await w.s.advanceTime(500);
      await w.s.apply(restart, 'server', { preserveLocalDb: true });
    },
    appBackgrounded: async (w, p) => {
      await w.s.apply(foreground, pick(p, 'person'), false);
      await w.s.advanceTime(1_000);
      await w.s.apply(foreground, pick(p, 'person'), true);
    },
    signInExpires: (w, p) => w.s.apply(auth, pick(p, 'person'), 'expired'),
    secondWindow: async (w, p) => {
      const person = pick(p, 'person');
      await w.s.apply(addPeerEngine, windowId(person), person);
      w.windows.add(person);
    },
    refreshHiccup: async (w, p) => {
      const person = pick(p, 'person');
      await w.s.apply(
        httpFault,
        person,
        lookup(REFRESH_HICCUPS, pick(p, 'hiccup'))
      );
      await w.s.apply(nudge, person);
    },
    connectionFlaky: (w, p) =>
      w.s.apply(netSet, pick(p, 'person'), 'sync', FLAKY),
    teamEdit: (w, p) =>
      w.s.apply(serverOp, 'writeNoteBodySilent', {
        noteId: pick(p, 'title'),
        body: pick(p, 'body'),
      }),
  },
  observe: async (w) => {
    const shared = await liveNotesOf(w, 'server');
    const notes = new Map([[SHARED, shared.bodies]]);
    const owners = new Map([[SHARED, shared.owners]]);
    const refused = new Map<string, number>();
    const unsent = new Map<string, number>();
    for (const person of PEOPLE) {
      const device = await liveNotesOf(w, person);
      notes.set(person, device.bodies);
      owners.set(person, device.owners);
      refused.set(person, (await w.s.read(rejections, person)).length);
      unsent.set(person, await unsentOf(w, person));
    }
    return { notes, owners, rejections: refused, unsent };
  },
});
