/**
 * What spaces contributes to a server: the room topics an actor may subscribe
 * to, and what they may do in a space's live room (the grants the room
 * gateway admits their connection with).
 *
 * The platform grants every actor their own topic; a space is a second place
 * their rows arrive from, and only spaces knows which spaces they are in.
 */

import { defineFeatureServer } from '@libs/feature-shared/server';
import { roomTopic } from '@libs/spaces-shared/space-room-topic';
import type { RoomServicePort } from '@pkgs/room-shared/room-service';
import { MySpaceIdsLoader } from './load-my-space-ids-sql';
import { spaceRoomGrants } from './space-room-grants';
import { registerSpaceWithdrawal } from './space-withdrawal-consumer';

export function createSpacesServer(rooms: RoomServicePort) {
  return defineFeatureServer({
    name: 'spaces',
    pubsubTopics: async (ctx) => {
      const spaceIds = await new MySpaceIdsLoader(ctx.db).load(ctx.actorId);
      return spaceIds.map((id) => roomTopic(id));
    },
    roomGrants: spaceRoomGrants,
    registerOutbox: (registry) => registerSpaceWithdrawal(registry, rooms),
  });
}
