/**
 * Binds `note-replication.qnt` to `exampleSystem`: each model action is one
 * or two `s.apply` calls with the values Quint drew, and `observe` reads the
 * model's observable variables (`notes`, `rejections`) back out of the sim.
 */

import { bindQuintModel, type Picks } from '@pkgs/quint/registry';
import {
  addClient,
  connect,
  crash,
  deleteNote,
  disconnect,
  httpFault,
  lastMutationId,
  liveNotes,
  mutate,
  netSet,
  outcome,
  rejections,
  restart,
  serverOp,
  setNote,
} from '@pkgs/sync-engine/sim';
import type { NoteWorld } from './note-world';

const PEOPLE = ['alice', 'bob'] as const;
const SHARED = 'shared';

/** A lost confirmation retries after request timeout + backoff. */
const RETRY_MAX_MS = 120_000;

const LOSSY_LIVE = {
  dropProbability: 0.4,
  packetReplayProbability: 0.5,
  reorderWindow: 5,
  latencyMeanMs: 15,
  latencyJitterMs: 25,
} as const;

const pick = (picks: Picks, name: string): string => String(picks[name]);

async function liveNoteMap(w: NoteWorld, node: string) {
  const rows = await w.s.read(liveNotes, node);
  return new Map(rows.map((row) => [row.id, row.body]));
}

bindQuintModel<NoteWorld>({
  model: 'note-replication',
  traces: 12,
  maxSteps: 12,
  actions: {
    init: async (w) => {
      for (const person of PEOPLE) await w.s.apply(addClient, person);
    },
    setNote: (w, p) =>
      w.s.apply(mutate, pick(p, 'person'), setNote, {
        id: pick(p, 'id'),
        body: pick(p, 'body'),
      }),
    deleteNote: (w, p) =>
      w.s.apply(mutate, pick(p, 'person'), deleteNote, { id: pick(p, 'id') }),
    setNoteReplyLost: async (w, p) => {
      const person = pick(p, 'person');
      await w.s.apply(httpFault, person, { kind: 'dropMutationsResponse' });
      await w.s.apply(mutate, person, setNote, {
        id: pick(p, 'id'),
        body: pick(p, 'body'),
      });
      const id = await w.s.read(lastMutationId, person);
      if (id !== null) w.owed.set(person, id);
    },
    retryUpload: async (w, p) => {
      const person = pick(p, 'person');
      const id = w.owed.get(person);
      if (id === undefined) throw new Error(`${person} owes no retry`);
      w.owed.delete(person);
      await w.s.until((s) => outcome(s, person, id), {
        maxMs: RETRY_MAX_MS,
        pred: (v) => v === 'confirmed',
      });
    },
    goOffline: (w, p) => w.s.apply(disconnect, pick(p, 'person')),
    goOnline: (w, p) => w.s.apply(connect, pick(p, 'person')),
    crashAndReopen: async (w, p) => {
      // A crash keeps the device's on-disk database.
      await w.s.apply(crash, pick(p, 'person'));
      await w.s.apply(restart, pick(p, 'person'), { preserveLocalDb: true });
    },
    degradeLive: async (w, p) => {
      await w.s.apply(netSet, pick(p, 'person'), 'live', LOSSY_LIVE);
      await w.s.advanceTime(10);
    },
    operatorEdit: (w, p) =>
      w.s.apply(serverOp, 'writeNoteBodySilent', {
        noteId: pick(p, 'id'),
        body: pick(p, 'body'),
      }),
  },
  observe: async (w) => {
    const notes = new Map([[SHARED, await liveNoteMap(w, 'server')]]);
    const refused = new Map<string, number>();
    for (const person of PEOPLE) {
      notes.set(person, await liveNoteMap(w, person));
      refused.set(person, (await w.s.read(rejections, person)).length);
    }
    return { notes, rejections: refused };
  },
});
