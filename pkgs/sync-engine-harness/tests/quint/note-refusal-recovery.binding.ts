import type { Picks } from '@pkgs/quint-shared/registry';
import { bindQuintModel } from '@pkgs/quint-shared/registry';
import {
  checkedNoteConsidered,
  prepareExistingCheckedNote,
} from '@pkgs/sync-engine-harness/checked-note-setup';
import { pendingNote } from '@pkgs/sync-engine-harness/mutations';
import { liveNote } from '@pkgs/sync-engine-harness/reads';
import {
  addClient,
  connect,
  disconnect,
  online as setOnline,
  startMutate,
} from '@pkgs/sync-engine-harness/regression-actions';
import {
  httpFault,
  partition,
  resumeNetwork,
} from '@pkgs/sync-engine-harness/regression-random-faults-actions';
import {
  deviceOnlineSignal,
  lastMutationOk,
  lastMutationSettled,
  queuedEdits,
  rejections,
} from '@pkgs/sync-engine-harness/sync-observations';
import type { NoteWorld } from './note-world';

const PEOPLE = ['alice', 'bob'] as const;
const TITLE = 'Groceries';
const ANSWER_MS = 120_000;
const personOf = (p: Picks) => String(p['person']);

async function waitUntilConsidered(
  w: NoteWorld,
  person: string
): Promise<void> {
  const id = w.owed.get(person);
  if (id === undefined) throw new Error(`${person} has no pending writing`);
  await w.s.until((s) => checkedNoteConsidered(s, id), {
    maxMs: ANSWER_MS,
  });
  await w.s.apply(partition, person, 'sync');
  w.recovery.accepted.add(person);
}

async function writeUnheard(w: NoteWorld, p: Picks): Promise<void> {
  const person = personOf(p);
  await w.s.apply(httpFault, person, { kind: 'dropMutationsResponse' });
  await w.s.apply(startMutate, person, pendingNote, {
    id: TITLE,
    title: TITLE,
    body: String(p['body']),
  });
  await w.s.until((s) => queuedEdits(s, person), {
    maxMs: ANSWER_MS,
    pred: (ids) => ids?.length === 1,
  });
  const id = (await w.s.read(queuedEdits, person))?.[0];
  if (id === undefined) throw new Error(`${person} made no write`);
  w.owed.set(person, id);
  if (await w.s.read(deviceOnlineSignal, person))
    await waitUntilConsidered(w, person);
}

async function goOnline(w: NoteWorld, person: string): Promise<void> {
  // An earlier answer stays unheard until the model's hearBack transition.
  if (w.owed.has(person) && w.recovery.accepted.has(person)) {
    await w.s.apply(httpFault, person, { kind: 'dropMutationsResponse' });
    await w.s.apply(resumeNetwork, person, 'sync');
  }
  await w.s.apply(setOnline, person, true);
  await w.s.apply(connect, person);
  if (w.owed.has(person)) await waitUntilConsidered(w, person);
}

async function observe(w: NoteWorld) {
  const notes = new Map<string, { body: string; owner: string }>();
  const answers = new Map<string, string>();
  const notices = new Map<string, number>();
  const online = new Map<string, boolean>();
  for (const person of ['server', ...PEOPLE]) {
    const note = await w.s.read(liveNote, person, TITLE);
    notes.set(
      person === 'server' ? 'shared' : person,
      note === null || note.deletedAt !== null
        ? { body: '', owner: '' }
        : { body: note.body, owner: note.ownerId }
    );
  }
  for (const person of PEOPLE) {
    const settled = await w.s.read(lastMutationSettled, person);
    const pending = (await w.s.read(queuedEdits, person))?.length ?? 0;
    answers.set(
      person,
      settled
        ? (await w.s.read(lastMutationOk, person))
          ? 'saved'
          : 'refused'
        : pending > 0
          ? 'saving'
          : 'ready'
    );
    notices.set(person, (await w.s.read(rejections, person)).length);
    online.set(person, await w.s.read(deviceOnlineSignal, person));
  }
  return { notes, answers, rejections: notices, online };
}

bindQuintModel<NoteWorld>({
  model: 'note-refusal-recovery',
  traces: 256,
  maxSteps: 40,
  verifySteps: 8,
  actions: {
    init: async (w, p) => {
      for (const person of PEOPLE) await w.s.apply(addClient, person);
      await w.s.apply(
        prepareExistingCheckedNote,
        p['earlierNote'] as { body: string; owner: string }
      );
    },
    writeUnheard,
    hearBack: async (w, p) => {
      const person = personOf(p);
      await w.s.apply(resumeNetwork, person, 'sync');
      await w.s.until((s) => lastMutationSettled(s, person), {
        maxMs: ANSWER_MS,
        pred: Boolean,
      });
      w.owed.delete(person);
    },
    goOffline: async (w, p) => {
      await w.s.apply(setOnline, personOf(p), false);
      await w.s.apply(disconnect, personOf(p));
    },
    goOnline: (w, p) => goOnline(w, personOf(p)),
  },
  observe,
  fingerprint: async (w) => JSON.stringify([...(await observe(w)).notes]),
});
