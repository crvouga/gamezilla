import { expect, test } from 'bun:test';
import { createInProcessRoomNode } from '@libs/spaces-harness-ts/in-process-room-node';
import {
  SpaceAwayChanged,
  SpaceMembersRoomAttr,
  SpaceSeatJoined,
} from '@libs/spaces-shared-ts/space-members-messages';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ROOM_PRESENCE_IDENTITY } from '@pkgs/room-root-shared-ts/builtin';
import { ROOM_SERVICE_IDENTITY } from '@pkgs/room-root-shared-ts/service-identity';

test('restoring a room immediately preserves its full pre-choice member history', async () => {
  // regression: room-checkpoint-initial-hydration-race
  const { clock, timers } = createHarnessClock({ startMs: 100 });
  let id = 0;
  const node = createInProcessRoomNode(
    {
      clock,
      timers,
      seed: 1n,
      random: () => 0.5,
      createId: () => `id-${id++}`,
    },
    { games: [], gateway: { roomGrants: async () => [] } }
  );
  const presence = { id: ROOM_PRESENCE_IDENTITY, clientId: 'scheduler' };
  const entries = [
    {
      seq: 1,
      event: SpaceSeatJoined({ memberId: 'alice' }),
      actor: { id: ROOM_SERVICE_IDENTITY, clientId: 'scheduler' },
      ts: 0,
    },
    {
      seq: 2,
      event: SpaceAwayChanged({ away: { alice: 2 } }),
      actor: presence,
      ts: 2,
    },
    {
      seq: 3,
      event: SpaceAwayChanged({ away: {} }),
      actor: presence,
      ts: 100,
    },
  ];
  try {
    // The immediate call starts the empty load before installing these rows.
    // Its last-sequence await must finish before replacement can hydrate them.
    await node.replaceTopic('space:paired', {
      entries,
      dedup: {},
      liveCheckpoint: null,
    });
    const state = await node.services.read('space:paired');
    expect(node.exportTopic('space:paired')?.entries).toEqual(entries);
    expect(Object.keys(SpaceMembersRoomAttr.seats.from(state))).toEqual([
      'alice',
    ]);
    expect(SpaceMembersRoomAttr.away.from(state)).toEqual({});
  } finally {
    node.dispose();
  }
});
