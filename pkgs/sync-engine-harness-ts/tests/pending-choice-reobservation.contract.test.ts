import { expect, test } from 'bun:test';
import { exampleSystem } from '@pkgs/sync-engine-harness-ts/example-app-system';
import { pendingNote } from '@pkgs/sync-engine-harness-ts/mutations';
import { addClient } from '@pkgs/sync-engine-harness-ts/regression-actions';
import { netSet } from '@pkgs/sync-engine-harness-ts/regression-random-faults-actions';

// regression: reobserving-pending-choice-submits-again
test('checking an identical pending choice keeps its original mutation identity', async () => {
  await using s = await exampleSystem.run({
    seed: 1,
    args: { clientCount: 0 },
  });
  await s.apply(addClient, 'alice');
  await s.apply(netSet, 'alice', 'sync', 'hold');
  const client = await s.read((h) => h.clients.get('alice'));
  if (client === undefined) throw new Error('No Alice');
  const feedback = client.engine.mutationFeedback(pendingNote.name);
  const stop = feedback.subscribe(() => undefined);
  const first = client.mutate(pendingNote, {
    id: 'Groceries',
    body: 'milk',
    title: 'Groceries',
  });
  const original = await s.until(() => feedback.getSnapshot()[0] ?? null, {
    pred: (row) => row?.status === 'pending',
    maxMs: 15_000,
  });
  const checking = client.mutate(pendingNote, {
    title: 'Groceries',
    body: 'milk',
    id: 'Groceries',
  });
  await s.advanceTime(1_000);
  try {
    expect(feedback.getSnapshot()[0]?.mutationId).toBe(original?.mutationId);
    expect(await client.engine.pendingMutationCount()).toBe(1);
  } finally {
    await s.apply(netSet, 'alice', 'sync', 'ok');
    await s.until(() => feedback.getSnapshot()[0]?.status === 'confirmed', {
      maxMs: 15_000,
    });
    await Promise.all([first, checking]);
    stop();
  }
});

// regression: reobserving-pending-choice-submits-again
test('returning to an earlier value after a different choice keeps the newer intent', async () => {
  await using s = await exampleSystem.run({
    seed: 1,
    args: { clientCount: 0 },
  });
  await s.apply(addClient, 'alice');
  await s.apply(netSet, 'alice', 'sync', 'hold');
  const client = await s.read((h) => h.clients.get('alice'));
  if (client === undefined) throw new Error('No Alice');
  const feedback = client.engine.mutationFeedback(pendingNote.name);
  const stop = feedback.subscribe(() => undefined);
  const changes: Promise<unknown>[] = [];
  const write = async (body: string): Promise<void> => {
    changes.push(
      client.mutate(pendingNote, { id: 'Groceries', body, title: 'Groceries' })
    );
    await s.advanceTime(1_000);
  };
  await write('milk');
  const first = feedback.getSnapshot()[0]?.mutationId;
  await write('bread');
  await write('milk');
  try {
    expect(feedback.getSnapshot()[0]?.mutationId).not.toBe(first);
    expect(await client.engine.pendingMutationCount()).toBe(3);
  } finally {
    await s.apply(netSet, 'alice', 'sync', 'ok');
    await s.until(() => feedback.getSnapshot()[0]?.status === 'confirmed', {
      maxMs: 15_000,
    });
    await Promise.all(changes);
    stop();
  }
});
