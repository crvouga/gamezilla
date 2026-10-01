/** One note, three independent devices, and confirmations crossing later edits. */

import { bindQuintModel, type Picks } from '@pkgs/quint/registry';
import {
  addClient,
  auth,
  connect,
  deleteNote,
  deviceOnlineSignal,
  disconnect,
  httpFault,
  lastMutationId,
  liveNote,
  liveNotes,
  mutate,
  nudge,
  outcome,
  partition,
  queuedEdits,
  rejections,
  restart,
  resumeNetwork,
  setNote,
  online as setOnline,
} from '@pkgs/sync-engine/harness';
import type { NoteWorld } from './note-world';

const PEOPLE = ['alice', 'bob', 'carol'] as const;
const TITLE = 'Groceries';
const CONFIRM_MS = 120_000;
const personOf = (p: Picks): string => String(p['person']);

async function write(w: NoteWorld, p: Picks): Promise<void> {
  await w.s.apply(mutate, personOf(p), setNote, {
    id: TITLE,
    body: String(p['body']),
  });
}

async function hearBack(w: NoteWorld, person: string): Promise<void> {
  const id = w.owed.get(person);
  if (id === undefined) throw new Error(`${person} awaits no confirmation`);
  await w.s.apply(resumeNetwork, person, 'sync');
  await w.s.until((s) => outcome(s, person, id), {
    maxMs: CONFIRM_MS,
    pred: (value) => value === 'confirmed',
  });
  w.owed.delete(person);
}

async function observe(w: NoteWorld) {
  const notes = new Map<
    string,
    { body: string; owner: string; exists: boolean; deleted: boolean }
  >();
  const refusals = new Map<string, number>();
  const online = new Map<string, boolean>();
  for (const person of ['server', ...PEOPLE]) {
    const row = await w.s.read(liveNote, person, TITLE);
    const key = person === 'server' ? 'shared' : person;
    notes.set(
      key,
      row === null
        ? { body: '', owner: '', exists: false, deleted: false }
        : {
            body: row.body,
            owner: row.ownerId,
            exists: true,
            deleted: row.deletedAt !== null,
          }
    );
  }
  for (const person of PEOPLE) {
    refusals.set(person, (await w.s.read(rejections, person)).length);
    online.set(person, await w.s.read(deviceOnlineSignal, person));
  }
  return { notes, rejections: refusals, online };
}

bindQuintModel<NoteWorld>({
  model: 'note-conflicts',
  verifySteps: 8,
  inductiveInvariant: '_inductive',
  traces: 256,
  maxSteps: 40,
  actions: {
    init: async (w) => {
      for (const person of PEOPLE) await w.s.apply(addClient, person);
    },
    write,
    deleteNote: (w, p) =>
      w.s.apply(mutate, personOf(p), deleteNote, { id: TITLE }),
    writeUnheard: async (w, p) => {
      const person = personOf(p);
      await w.s.apply(httpFault, person, { kind: 'dropMutationsResponse' });
      await write(w, p);
      const id = await w.s.read(lastMutationId, person);
      if (id === null) throw new Error(`${person} made no write`);
      await w.s.until((s) => liveNote(s, 'server', TITLE), {
        maxMs: CONFIRM_MS,
        pred: (row) => row?.ownerId === person,
      });
      await w.s.apply(partition, person, 'sync');
      w.owed.set(person, id);
    },
    hearBack: (w, p) => hearBack(w, personOf(p)),
    goOffline: async (w, p) => {
      await w.s.apply(setOnline, personOf(p), false);
      await w.s.apply(disconnect, personOf(p));
    },
    goOnline: async (w, p) => {
      const person = personOf(p);
      await w.s.apply(setOnline, person, true);
      await w.s.apply(resumeNetwork, person, 'sync');
      await w.s.apply(connect, person);
      await w.s.until((s) => queuedEdits(s, person), {
        maxMs: CONFIRM_MS,
        pred: (ids) => ids?.length === 0,
      });
      w.owed.delete(person);
    },
    signedOutElsewhere: async (w, p) => {
      const person = personOf(p);
      await w.s.apply(setOnline, person, true);
      await w.s.apply(auth, person, 'revoked');
      await w.s.apply(resumeNetwork, person, 'sync');
      await w.s.apply(connect, person);
      await w.s.apply(nudge, person).catch(() => undefined);
      await w.s.advanceTime(5_000);
      await w.s.apply(restart, person, { preserveLocalDb: true });
      w.owed.delete(person);
    },
  },
  observe,
  fingerprint: async (w) => {
    const rows = [];
    for (const person of ['server', ...PEOPLE]) {
      rows.push(await w.s.read(liveNotes, person));
    }
    return JSON.stringify(rows);
  },
});
