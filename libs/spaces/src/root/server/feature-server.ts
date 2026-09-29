/**
 * What spaces contributes to a server: the room topics an actor may subscribe
 * to, and what they may do in a space's live room (the grants the room
 * gateway admits their connection with).
 *
 * The platform grants every actor their own topic; a space is a second place
 * their rows arrive from, and only spaces knows which spaces they are in.
 */

import { defineFeatureServer } from '@libs/feature/public/server';
import { roomTopic } from '../../public/room/space-room-topic';

import { MySpaceIdsLoader } from './load-my-space-ids-sql';
import { spaceRoomGrants } from './space-room-grants';

export const SPACES_SERVER = defineFeatureServer({
  name: 'spaces',
  pubsubTopics: async (ctx) => {
    const spaceIds = await new MySpaceIdsLoader(ctx.db).load(ctx.actorId);
    return spaceIds.map((id) => roomTopic(id));
  },
  roomGrants: spaceRoomGrants,
});
