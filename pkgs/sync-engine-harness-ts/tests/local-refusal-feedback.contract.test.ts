import { expect, test } from 'bun:test';
import { exampleSystem } from '@pkgs/sync-engine-harness-ts/example-app-system';
import { pendingNote } from '@pkgs/sync-engine-harness-ts/mutations';
import { liveNote } from '@pkgs/sync-engine-harness-ts/reads';
import { exampleMutationRegistry } from '@pkgs/sync-engine-harness-ts/registries';
import {
  addClient,
  mutate,
} from '@pkgs/sync-engine-harness-ts/regression-actions';
import {
  crash,
  netSet,
  restart,
} from '@pkgs/sync-engine-harness-ts/regression-random-faults-actions';
import { lastMutationOk } from '@pkgs/sync-engine-harness-ts/sync-observations';

const localNote = { ...pendingNote, pendingUx: 'local' as const };
const NOTE = { id: 'Groceries', title: 'Groceries' };

test('a local refusal rolls back the choice and remains visible after reopening', async () => {
  // regression: sync-local-refusal-feedback-lost-on-reopen
  await using s = await exampleSystem.run({
    seed: 1,
    args: { clientCount: 0 },
  });
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
    pred: (row) => row?.body === 'milk',
  });
  const alice = await s.read((h) => h.clients.get('alice'));
  if (alice === undefined) throw new Error('No Alice');
  let feedback = alice.engine.mutationFeedback(localNote.name, { id: NOTE.id });
  let stop = feedback.subscribe(() => undefined);
  await s.until(() => feedback.getSnapshot()[0]?.status, {
    pred: (status) => status === 'confirmed',
  });
  await s.apply(netSet, 'alice', 'sync', 'hold');
  await s.apply(mutate, 'alice', localNote, {
    ...NOTE,
    body: 'locally-refused',
  });
  expect(await s.read(lastMutationOk, 'alice')).toBe(false);
  expect(await s.read(liveNote, 'alice', NOTE.id)).toMatchObject({
    body: 'milk',
  });
  await s.until(() => feedback.getSnapshot()[0]?.status, {
    pred: (status) => status === 'rejected',
  });
  const refusal = feedback.getSnapshot()[0];
  expect(refusal).toMatchObject({ status: 'rejected', code: 'LOCAL_REFUSAL' });
  stop();
  await s.apply(crash, 'alice');
  await s.apply(restart, 'alice', { preserveLocalDb: true });
  const reopened = await s.read((h) => h.clients.get('alice'));
  if (reopened === undefined) throw new Error('No reopened Alice');
  feedback = reopened.engine.mutationFeedback(localNote.name, { id: NOTE.id });
  stop = feedback.subscribe(() => undefined);
  await s.until(() => feedback.getHydrated());
  expect(feedback.getSnapshot()[0]).toEqual(refusal);
  await s.apply(netSet, 'alice', 'sync', 'ok');
  await s.advanceTime(1_000);
  expect(await s.read(liveNote, 'bob', NOTE.id)).toMatchObject({
    body: 'milk',
  });
  await s.apply(mutate, 'alice', localNote, { ...NOTE, body: 'bread' });
  expect(await s.read(lastMutationOk, 'alice')).toBe(true);
  await s.until(() => feedback.getSnapshot()[0]?.status, {
    pred: (status) => status === 'confirmed',
  });
  expect(feedback.getSnapshot()[0]?.mutationId).not.toBe(refusal?.mutationId);
  await s.until((h) => liveNote(h, 'bob', NOTE.id), {
    pred: (row) => row?.body === 'bread',
  });
  stop();
});
