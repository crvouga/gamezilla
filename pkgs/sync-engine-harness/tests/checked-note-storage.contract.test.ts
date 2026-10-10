import { expect, test } from 'bun:test';
import { exampleSystem } from '@pkgs/sync-engine-harness/example-app-system';
import { pendingNote } from '@pkgs/sync-engine-harness/mutations';
import { liveNote } from '@pkgs/sync-engine-harness/reads';
import {
  addClient,
  startMutate,
} from '@pkgs/sync-engine-harness/regression-actions';
import {
  httpFault,
  netSet,
} from '@pkgs/sync-engine-harness/regression-random-faults-actions';
import {
  lastMutationId,
  lastMutationOk,
  lastMutationSettled,
  outcome,
} from '@pkgs/sync-engine-harness/sync-observations';

type Run = Awaited<ReturnType<typeof exampleSystem.run>>;
const NOTE = { id: 'Groceries', title: 'Groceries', body: 'milk' };
const SETTLE_MS = 15_000;
const SLOW = {
  latencyMeanMs: 60,
  latencyJitterMs: 40,
  dropProbability: 0,
  packetReplayProbability: 0,
  reorderWindow: 0,
  partitionProbability: 0,
  healProbability: 0,
} as const;

async function answer(s: Run): Promise<void> {
  await s.until((h) => lastMutationSettled(h, 'alice'), {
    maxMs: SETTLE_MS,
  });
}

async function writeMilk(s: Run): Promise<void> {
  await s.apply(startMutate, 'alice', pendingNote, NOTE);
  await answer(s);
  expect(await s.read(lastMutationOk, 'alice')).toBe(true);
}

test('an accepted checked write stores its row and confirms its verdict', async () => {
  // regression: checked-note-answer-lost-to-push-race
  await using s = await exampleSystem.run({
    seed: 1,
    args: { clientCount: 0 },
  });
  await s.apply(addClient, 'alice');
  await writeMilk(s);
  const id = await s.read(lastMutationId, 'alice');
  if (id === null) throw new Error('The accepted mutation has no id');
  expect(await s.read(outcome, 'alice', id)).toBe('confirmed');
  expect(await s.read(liveNote, 'server', NOTE.id)).toMatchObject({
    title: 'Groceries',
    body: 'milk',
    deletedAt: null,
  });
});

test('a refused checked draft never fans out when its response is dropped', async () => {
  // regression: sync-refused-draft-reached-another-person
  await using s = await exampleSystem.run({
    seed: 1,
    args: { clientCount: 0 },
  });
  for (const actor of ['alice', 'bob']) {
    await s.apply(addClient, actor);
    await s.apply(netSet, actor, 'live', SLOW);
    await s.apply(netSet, actor, 'sync', SLOW);
  }
  await writeMilk(s);
  await s.until((h) => liveNote(h, 'bob', NOTE.id), {
    pred: (row) => row?.body === 'milk',
    maxMs: SETTLE_MS,
  });
  await s.apply(httpFault, 'alice', { kind: 'dropMutationsResponse' });
  await s.apply(startMutate, 'alice', pendingNote, {
    ...NOTE,
    body: 'refused',
  });
  await s.never((h) => liveNote(h, 'bob', NOTE.id), {
    forMs: SETTLE_MS,
    stepMs: 1,
    pred: (row) => row?.deletedAt === null && row.body === 'refused',
  });
  expect(await s.read(liveNote, 'server', NOTE.id)).toMatchObject({
    title: 'Groceries',
    body: 'milk',
    deletedAt: null,
  });
});

test('a permanent refusal rolls back preceding domain writes on the server', async () => {
  // regression: sync-refused-write-left-domain-changes
  await using s = await exampleSystem.run({
    seed: 1,
    args: { clientCount: 0 },
  });
  await s.apply(addClient, 'alice');
  await s.apply(startMutate, 'alice', pendingNote, {
    ...NOTE,
    body: 'refused',
  });
  await answer(s);
  expect(await s.read(lastMutationOk, 'alice')).toBe(false);
  expect(await s.read(liveNote, 'server', NOTE.id)).toBeNull();
});

test('a rejected checked overwrite rolls back before reporting its verdict', async () => {
  // regression: pending-reject-verdict-before-rollback
  await using s = await exampleSystem.run({
    seed: 1,
    args: { clientCount: 0 },
  });
  await s.apply(addClient, 'alice');
  await writeMilk(s);
  await s.apply(startMutate, 'alice', pendingNote, {
    ...NOTE,
    body: 'refused',
  });
  await answer(s);
  expect(await s.read(lastMutationOk, 'alice')).toBe(false);
  for (const replica of ['alice', 'server']) {
    expect(await s.read(liveNote, replica, NOTE.id)).toMatchObject({
      title: 'Groceries',
      body: 'milk',
      deletedAt: null,
    });
  }
});
