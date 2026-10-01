/** Independent lost confirmations, held only after the actual first acceptance. */

import { bindQuintModel, type Picks } from '@pkgs/quint/registry';
import {
  addClient,
  connect,
  deviceOnlineSignal,
  disconnect,
  httpFault,
  lastMutationId,
  liveNote,
  mutate,
  outcome,
  partition,
  resumeNetwork,
  setNote,
  online as setOnline,
} from '@pkgs/sync-engine/harness';
import type { NoteWorld } from './note-world';

const PEOPLE = ['alice', 'bob', 'carol'] as const;
const TITLE = 'Groceries';
const CONFIRM_MS = 120_000;
const personOf = (p: Picks): string => String(p['person']);

async function holdAcceptedSave(w: NoteWorld, person: string): Promise<void> {
  await w.s.until((s) => liveNote(s, 'server', TITLE), {
    maxMs: CONFIRM_MS,
    pred: (row) => row?.ownerId === person,
  });
  await w.s.apply(partition, person, 'sync');
  w.recovery.accepted.add(person);
}

async function writeUnheard(w: NoteWorld, p: Picks): Promise<void> {
  const person = personOf(p);
  await w.s.apply(httpFault, person, { kind: 'dropMutationsResponse' });
  await w.s.apply(mutate, person, setNote, {
    id: TITLE,
    body: String(p['body']),
  });
  const id = await w.s.read(lastMutationId, person);
  if (id === null) throw new Error(`${person} made no write`);
  w.owed.set(person, id);
  if (!w.recovery.offline.has(person)) await holdAcceptedSave(w, person);
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

async function goOnline(w: NoteWorld, person: string): Promise<void> {
  await w.s.apply(setOnline, person, true);
  await w.s.apply(connect, person);
  w.recovery.offline.delete(person);
  if (w.owed.has(person) && !w.recovery.accepted.has(person)) {
    await holdAcceptedSave(w, person);
  }
}

async function observe(w: NoteWorld) {
  const notes = new Map<string, { body: string; owner: string }>();
  const online = new Map<string, boolean>();
  for (const person of ['server', ...PEOPLE]) {
    const row = await w.s.read(liveNote, person, TITLE);
    notes.set(
      person === 'server' ? 'shared' : person,
      row === null
        ? { body: '', owner: '' }
        : { body: row.body, owner: row.ownerId }
    );
  }
  for (const person of PEOPLE)
    online.set(person, await w.s.read(deviceOnlineSignal, person));
  return { notes, online };
}

bindQuintModel<NoteWorld>({
  model: 'note-recovery',
  verifySteps: 8,
  traces: 256,
  maxSteps: 40,
  actions: {
    init: async (w) => {
      for (const person of PEOPLE) await w.s.apply(addClient, person);
    },
    writeUnheard,
    hearBack: (w, p) => hearBack(w, personOf(p)),
    goOffline: async (w, p) => {
      const person = personOf(p);
      await w.s.apply(setOnline, person, false);
      await w.s.apply(disconnect, person);
      w.recovery.offline.add(person);
    },
    goOnline: (w, p) => goOnline(w, personOf(p)),
  },
  observe,
  fingerprint: async (w) => JSON.stringify([...(await observe(w)).notes]),
});
