import { expect, test } from 'bun:test';
import { openConformanceDb } from '@libs/permissions-shared/world';
import { createInProcessRoomNode } from '@libs/spaces-harness/in-process-room-node';
import { SPACE_TABLES } from '@libs/spaces-harness/space-decision-world';
import { spaceRoomGrants } from '@libs/spaces-server/space-room-grants';
import { registerSpaceWithdrawal } from '@libs/spaces-server/space-withdrawal-consumer';
import { createSpaceMutation } from '@libs/spaces-shared/create-space-mutation';
import { spaceSeatMemberIds } from '@libs/spaces-shared/space-members-messages';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { OutboxConsumerRegistry } from '@pkgs/outbox-shared/define-consumer';
import { drainOutbox } from '@pkgs/outbox-shared/drain';
import { reconcileOutbox } from '@pkgs/outbox-shared/reconcile';
import type { MutationEnv } from '@pkgs/sync-engine-shared/mutations-types';
import { wrapMutationDb } from '@pkgs/sync-engine-shared/wrap-mutation-db';

// regression: space-membership-wrong-room-topic
test('membership deliveries update the room devices connect to', async () => {
  const spaceId = 'f724f291-a735-477a-b014-e07c4d070f8c';
  const memberId = 'bd77dc60-49af-491b-91d4-21e8856ca939';
  const { clock, timers } = createHarnessClock({ startMs: 1_000 });
  let ids = 0;
  const createId = () => `delivery-${++ids}`;
  const db = await openConformanceDb(SPACE_TABLES);
  await reconcileOutbox(db);
  const node = createInProcessRoomNode(
    { clock, timers, createId, seed: 1n, random: () => 0.5 },
    {
      games: [],
      gateway: {
        roomGrants: ({ topic, actor }) =>
          spaceRoomGrants({ db, topic, actor, nowMs: clock.now() }) ??
          Promise.resolve([]),
      },
    }
  );
  const env: MutationEnv = {
    actorId: memberId,
    deviceId: memberId,
    accountId: null,
    isAnon: true,
    now: () => new Date(clock.now()),
    serverNow: () => new Date(clock.now()),
    createId,
  };
  try {
    await db.transaction(async (raw) => {
      const { tx } = wrapMutationDb(raw, env);
      await createSpaceMutation.run({ tx, env }, { spaceId });
    });
    const registry = new OutboxConsumerRegistry();
    registerSpaceWithdrawal(registry, node.services);
    expect(
      (await drainOutbox({ db, clock, createId, registry })).processed
    ).toBe(1);
    expect(node.listTopics()).toEqual([`space:${spaceId}`]);
    expect(
      spaceSeatMemberIds(await node.services.read(`space:${spaceId}`))
    ).toEqual([memberId]);
  } finally {
    node.dispose();
    await db.disconnect();
  }
});
