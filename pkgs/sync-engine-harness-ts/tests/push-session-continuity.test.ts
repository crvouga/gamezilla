import { expect, test } from 'bun:test';
import { exampleSystem } from '@pkgs/sync-engine-harness-ts/example-app-system';
import { notesAllWithColorQuery } from '@pkgs/sync-engine-harness-ts/hardening-fixtures';
import {
  createSpace,
  endSpace,
  joinSpace,
  leaveSpace,
} from '@pkgs/sync-engine-harness-ts/membership-mutations';
import { SPACE_MEMBERSHIP_SESSION } from '@pkgs/sync-engine-harness-ts/membership-query';
import { setNote } from '@pkgs/sync-engine-harness-ts/mutations';
import { colourNote } from '@pkgs/sync-engine-harness-ts/note-details';
import {
  hasTopic,
  lacksTopic,
  liveNote,
  noteColor,
} from '@pkgs/sync-engine-harness-ts/reads';
import {
  addClient,
  mutate,
  subscribe,
} from '@pkgs/sync-engine-harness-ts/regression-actions';
import {
  netSet,
  restartWithSchema,
} from '@pkgs/sync-engine-harness-ts/regression-random-faults-actions';
import {
  connection,
  lastError,
  liveReconnects,
  subscribedTopics,
} from '@pkgs/sync-engine-harness-ts/sync-observations';
import { roomTopic } from '@pkgs/sync-engine-harness-ts/topics';

const SETTLE_MS = 20_000;

for (const transition of ['leave', 'end'] as const) {
  test(`a ${transition} tombstone removes the room subscription without remaking a held client's push session`, async () => {
    await using s = await exampleSystem.run({
      seed: 1,
      args: { clientCount: 0 },
    });
    for (const actor of ['Alice', 'Bob']) {
      await s.apply(addClient, {
        id: actor,
        actorId: actor,
        sessionQuery: SPACE_MEMBERSHIP_SESSION,
      });
    }
    await s.apply(mutate, 'Alice', createSpace, { id: 'Trip' });
    await s.apply(mutate, 'Bob', joinSpace, { spaceId: 'Trip' });
    await s.until((h) => subscribedTopics(h, 'Bob'), {
      maxMs: SETTLE_MS,
      pred: hasTopic(roomTopic('Trip')),
    });
    if (transition === 'leave') {
      await s.apply(mutate, 'Bob', leaveSpace, { spaceId: 'Trip' });
      await s.until((h) => subscribedTopics(h, 'Bob'), {
        maxMs: SETTLE_MS,
        pred: lacksTopic(roomTopic('Trip')),
      });
    }
    await s.apply(netSet, 'Bob', 'sync', 'hold');
    if (transition === 'end') {
      await s.apply(mutate, 'Alice', endSpace, { spaceId: 'Trip' });
      await s.until((h) => subscribedTopics(h, 'Bob'), {
        maxMs: SETTLE_MS,
        pred: lacksTopic(roomTopic('Trip')),
      });
    }
    expect(await s.read(connection, 'Bob')).toBe('connected');
    expect(await s.read(lastError, 'Bob')).toBeNull();
    expect(await s.read(liveReconnects, 'Bob')).toBe(0);
  });
}

for (const variant of ['extraColumn', 'extraTable']) {
  test(`downgrading ${variant} keeps the engine and its push session connected`, async () => {
    await using s = await exampleSystem.run({
      seed: 1,
      args: { clientCount: 0 },
    });
    await s.apply(addClient, 'Alice');
    await s.apply(addClient, 'Bob');
    await s.apply(restartWithSchema, 'Alice', variant);
    await s.apply(mutate, 'Alice', setNote, {
      id: 'Groceries',
      title: 'Groceries',
      body: 'milk',
    });
    await s.apply(restartWithSchema, 'Alice', 'baseline');
    await s.until((h) => liveNote(h, 'Bob', 'Groceries'), {
      maxMs: SETTLE_MS,
      pred: (row) => row?.body === 'milk',
    });
    expect(await s.read(connection, 'Alice')).toBe('connected');
    expect(await s.read(lastError, 'Alice')).toBeNull();
    expect(await s.read(liveReconnects, 'Alice')).toBe(0);
  });
}

test('subscribing to an added column keeps the push session connected', async () => {
  await using s = await exampleSystem.run({
    seed: 1,
    args: { clientCount: 0 },
  });
  await s.apply(addClient, 'Alice');
  await s.apply(mutate, 'Alice', setNote, {
    id: 'Groceries',
    title: 'Groceries',
    body: 'milk',
  });
  await s.apply(restartWithSchema, 'server', 'extraColumn');
  await s.apply(colourNote, 'server', 'Groceries', 'green');
  await s.apply(restartWithSchema, 'Alice', 'extraColumn');
  await s.apply(subscribe, 'Alice', notesAllWithColorQuery.name, {});
  await s.until((h) => noteColor(h, 'Alice', 'Groceries'), {
    maxMs: SETTLE_MS,
    pred: (rows) => rows[0]?.color === 'green',
  });
  expect(await s.read(connection, 'Alice')).toBe('connected');
  expect(await s.read(lastError, 'Alice')).toBeNull();
  expect(await s.read(liveReconnects, 'Alice')).toBe(0);
});
