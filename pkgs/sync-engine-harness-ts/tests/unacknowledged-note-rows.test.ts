import { expect, test } from 'bun:test';
import { exampleSystem } from '@pkgs/sync-engine-harness-ts/example-app-system';
import {
  createSpace,
  joinSpace,
  setSpaceNote,
} from '@pkgs/sync-engine-harness-ts/membership-mutations';
import { SPACE_MEMBERSHIP_SESSION } from '@pkgs/sync-engine-harness-ts/membership-query';
import { hasTopic, liveNotes } from '@pkgs/sync-engine-harness-ts/reads';
import {
  addClient,
  mutate,
} from '@pkgs/sync-engine-harness-ts/regression-actions';
import {
  crash,
  httpFault,
  restart,
} from '@pkgs/sync-engine-harness-ts/regression-random-faults-actions';
import { subscribedTopics } from '@pkgs/sync-engine-harness-ts/sync-observations';
import { roomTopic } from '@pkgs/sync-engine-harness-ts/topics';

for (const interrupted of [false, true]) {
  test(`a lost mutation response keeps one note row per replica${interrupted ? ' across immediate restart' : ''}`, async () => {
    await using s = await exampleSystem.run({
      seed: 1,
      args: { clientCount: 0 },
    });
    for (const actor of ['alice', 'bob']) {
      await s.apply(addClient, {
        id: actor,
        actorId: actor,
        sessionQuery: SPACE_MEMBERSHIP_SESSION,
      });
    }
    await s.apply(mutate, 'alice', createSpace, { id: 'Trip', title: 'Trip' });
    await s.apply(mutate, 'bob', joinSpace, { spaceId: 'Trip' });
    for (const actor of ['alice', 'bob']) {
      await s.until((h) => subscribedTopics(h, actor), {
        maxMs: 15_000,
        pred: hasTopic(roomTopic('Trip')),
      });
    }
    await s.apply(httpFault, 'alice', { kind: 'dropMutationsResponse' });
    await s.apply(mutate, 'alice', setSpaceNote, {
      id: 'Groceries',
      spaceId: 'Trip',
      title: 'Groceries',
      body: 'milk',
    });
    if (interrupted) {
      await s.apply(crash, 'alice');
      await s.apply(restart, 'alice', { preserveLocalDb: true });
    }
    for (const node of ['alice', 'bob']) {
      const rows = await s.until((h) => liveNotes(h, node), {
        maxMs: 15_000,
        pred: (found) => found.some((row) => row.id === 'Groceries'),
      });
      expect(rows.filter((row) => row.title === 'Groceries')).toEqual([
        expect.objectContaining({ id: 'Groceries', body: 'milk' }),
      ]);
    }
  });
}
