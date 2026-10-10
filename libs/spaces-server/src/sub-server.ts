/**
 * What spaces contributes to a server: the room topics an actor may subscribe
 * to, and what they may do in a space's live room (the grants the room
 * gateway admits their connection with).
 *
 * The platform grants every actor their own topic; a space is a second place
 * their rows arrive from, and only spaces knows which spaces they are in.
 */

import { roomTopic } from '@libs/spaces-shared/space-room-topic';
import { SPACE_TELEMETRY } from '@libs/spaces-shared/telemetry';
import { defineSubServer } from '@libs/sub-shared/server';
import type { RoomServicePort } from '@pkgs/room-root-shared/room-service';
import { MySpaceIdsLoader } from './load-my-space-ids-sql';
import type { SpaceBlockRelation } from './space-restrictions';
import { registerSpaceRestrictions } from './space-restrictions';
import { spaceRoomGrants } from './space-room-grants';
import { registerSpaceWithdrawal } from './space-withdrawal-consumer';

/**
 * `blocks` is the friends context's published block relation; without it
 * (a composition with no friends) nobody in a space is restricted.
 */
export function createSpacesServer(
  rooms: RoomServicePort,
  blocks: SpaceBlockRelation | null = null
) {
  return defineSubServer({
    telemetryEvents: SPACE_TELEMETRY,
    name: 'spaces',
    pubsubTopics: async (ctx) => {
      const spaceIds = await new MySpaceIdsLoader(ctx.db).load(ctx.actorId);
      return spaceIds.map((id) => roomTopic(id));
    },
    roomGrants: spaceRoomGrants,
    registerOutbox: (registry) => {
      registerSpaceWithdrawal(registry, rooms, blocks);
      if (blocks !== null) registerSpaceRestrictions(registry, rooms, blocks);
    },
  });
}
