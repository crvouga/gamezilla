import { expect, test } from 'bun:test';
import type { MutationFeedback } from '@pkgs/sync-engine-client/mutation-status';
import type { WatchSubscription } from '@pkgs/sync-engine-client/sync-engine-port';
import { exampleSystem } from '@pkgs/sync-engine-harness/example-app-system';
import { pendingNote } from '@pkgs/sync-engine-harness/mutations';
import { liveNote } from '@pkgs/sync-engine-harness/reads';
import { exampleMutationRegistry } from '@pkgs/sync-engine-harness/registries';
import {
  addClient,
  mutate,
} from '@pkgs/sync-engine-harness/regression-actions';
import {
  crash,
  netSet,
  restart,
} from '@pkgs/sync-engine-harness/regression-random-faults-actions';
import type { SyncHarness } from '@pkgs/sync-engine-harness/scenario-system';
import { lastMutationOk } from '@pkgs/sync-engine-harness/sync-observations';
import { acknowledgeWriteRejectionMutation } from '@pkgs/sync-engine-shared/acknowledge-write-rejection';

type Run = Awaited<ReturnType<typeof exampleSystem.run>>;
type Feedback = WatchSubscription<readonly MutationFeedback[]>;
const localNote = { ...pendingNote, pendingUx: 'local' as const };
const NOTE = { id: 'Groceries', title: 'Groceries' };

function watchFeedback(s: SyncHarness, actor: string): Feedback {
  const client = s.clients.get(actor);
  if (client === undefined) throw new Error(`No client ${actor}`);
  return client.engine.mutationFeedback(localNote.name);
}

async function waitFeedback(s: Run, feedback: Feedback, status: string) {
  return s.until(() => feedback.getSnapshot()[0] ?? null, {
    maxMs: 15_000,
    pred: (row) => row?.status === status,
  });
}

async function openChoices(s: Run): Promise<void> {
  await s.apply(addClient, {
    id: 'alice',
    mutationRegistry: {
      ...exampleMutationRegistry,
      [localNote.name]: localNote,
    },
  });
  await s.apply(addClient, 'bob');
  await s.apply(mutate, 'alice', localNote, { ...NOTE, body: 'milk' });
  await s.until((h) => liveNote(h, 'bob', NOTE.id), {
    maxMs: 15_000,
    pred: (row) => row?.body === 'milk',
  });
}

test('local acceptance stays private and durable feedback survives refusal and reopening', async () => {
  // regression: sync-harness-mutation-skips-local-watch
  await using s = await exampleSystem.run({
    seed: 1,
    args: { clientCount: 0 },
  });
  await openChoices(s);
  let feedback = await s.read(watchFeedback, 'alice');
  const changes: string[] = [];
  let unsubscribe = feedback.subscribe(() => {
    const status = feedback.getSnapshot()[0]?.status;
    if (status !== undefined) changes.push(status);
  });
  await waitFeedback(s, feedback, 'confirmed');
  await s.apply(netSet, 'alice', 'sync', 'hold');
  await s.apply(mutate, 'alice', localNote, { ...NOTE, body: 'refused' });
  expect(await s.read(lastMutationOk, 'alice')).toBe(true);
  expect(await s.read(liveNote, 'alice', NOTE.id)).toMatchObject({
    body: 'refused',
  });
  await waitFeedback(s, feedback, 'pending');
  await s.advanceTime(1_000);
  expect(await s.read(liveNote, 'bob', NOTE.id)).toMatchObject({
    body: 'milk',
  });
  await s.apply(netSet, 'alice', 'sync', 'ok');
  const rejected = await waitFeedback(s, feedback, 'rejected');
  expect(rejected).toMatchObject({ code: 'REFUSED' });
  await s.until((h) => liveNote(h, 'alice', NOTE.id), {
    maxMs: 15_000,
    pred: (row) => row?.body === 'milk',
  });
  expect(await s.read(liveNote, 'bob', NOTE.id)).toMatchObject({
    body: 'milk',
  });
  expect(changes).toContain('pending');
  expect(changes).toContain('rejected');
  unsubscribe();
  await s.apply(crash, 'alice');
  await s.apply(restart, 'alice', { preserveLocalDb: true });
  feedback = await s.read(watchFeedback, 'alice');
  unsubscribe = feedback.subscribe(() => undefined);
  expect(await waitFeedback(s, feedback, 'rejected')).toEqual(rejected);
  await s.apply(netSet, 'alice', 'sync', 'hold');
  await s.apply(mutate, 'alice', localNote, { ...NOTE, body: 'bread' });
  const latest = await waitFeedback(s, feedback, 'pending');
  expect(latest?.mutationId).not.toBe(rejected?.mutationId);
  await s.apply(netSet, 'alice', 'sync', 'ok');
  expect(await waitFeedback(s, feedback, 'confirmed')).toMatchObject({
    mutationId: latest?.mutationId,
    code: null,
    rejectionId: null,
  });
  await s.until((h) => liveNote(h, 'bob', NOTE.id), {
    maxMs: 15_000,
    pred: (row) => row?.body === 'bread',
  });
  unsubscribe();
});

test('feedback belongs to its client and dismissing a refusal does not claim acceptance', async () => {
  await using s = await exampleSystem.run({
    seed: 1,
    args: { clientCount: 0 },
  });
  await openChoices(s);
  const alice = await s.read(watchFeedback, 'alice');
  const bob = await s.read(watchFeedback, 'bob');
  const stopAlice = alice.subscribe(() => undefined);
  const stopBob = bob.subscribe(() => undefined);
  await s.until(() => bob.getHydrated());
  expect(bob.getSnapshot()).toEqual([]);
  await s.apply(mutate, 'alice', localNote, { ...NOTE, body: 'refused' });
  const rejection = await waitFeedback(s, alice, 'rejected');
  const rejectionId = rejection?.rejectionId;
  if (rejectionId === null || rejectionId === undefined)
    throw new Error('No refusal id');
  await s.apply(mutate, 'alice', acknowledgeWriteRejectionMutation, {
    rejectionId,
  });
  await s.until(() => alice.getSnapshot(), {
    pred: (rows) => rows.length === 0,
  });
  expect(alice.getSnapshot()).toEqual([]);
  expect(bob.getSnapshot()).toEqual([]);
  stopAlice();
  stopBob();
});


test('feedback for one choice target survives newer choices for another target', async () => {
  // regression: sync-mutation-feedback-confuses-choice-targets
  await using s = await exampleSystem.run({ seed: 1, args: { clientCount: 0 } });
  await openChoices(s);
  const client = await s.read((h) => h.clients.get('alice'));
  if (client === undefined) throw new Error('No Alice');
  const groceries = client.engine.mutationFeedback(localNote.name, { id: NOTE.id });
  const itinerary = client.engine.mutationFeedback(localNote.name, { id: 'Itinerary' });
  const stopGroceries = groceries.subscribe(() => undefined);
  const stopItinerary = itinerary.subscribe(() => undefined);
  try {
    await waitFeedback(s, groceries, 'confirmed');
    await s.apply(netSet, 'alice', 'sync', 'hold');
    await s.apply(mutate, 'alice', localNote, { ...NOTE, body: 'refused' });
    const pendingGroceries = await waitFeedback(s, groceries, 'pending');
    await s.apply(mutate, 'alice', localNote, { id: 'Itinerary', title: 'Itinerary', body: 'train' });
    const pendingItinerary = await waitFeedback(s, itinerary, 'pending');
    expect(pendingGroceries?.mutationId).not.toBe(pendingItinerary?.mutationId);
    expect(groceries.getSnapshot()[0]?.mutationId).toBe(pendingGroceries?.mutationId);
    await s.apply(netSet, 'alice', 'sync', 'ok');
    expect(await waitFeedback(s, groceries, 'rejected')).toMatchObject({ mutationId: pendingGroceries?.mutationId, code: 'REFUSED' });
    expect(await waitFeedback(s, itinerary, 'confirmed')).toMatchObject({ mutationId: pendingItinerary?.mutationId, code: null });
  } finally { stopGroceries(); stopItinerary(); }
});
