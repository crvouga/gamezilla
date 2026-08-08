import { defineTopicMap } from '../../../shared/topic-map';
import { NOTES_WORLD_TOPIC, roomTopic, userTopic } from './topics';

export const notesTopicMap = defineTopicMap({
  notes: {
    topics(row, ctx) {
      const spaceId = row['space_id'];
      const room =
        typeof spaceId === 'string' && spaceId.length > 0
          ? [roomTopic(spaceId)]
          : [];
      return [NOTES_WORLD_TOPIC, userTopic(ctx.actorId), ...room];
    },
  },
  folders: {
    topics(_row, ctx) {
      return [NOTES_WORLD_TOPIC, userTopic(ctx.actorId)];
    },
  },
  tags: {
    topics(_row, ctx) {
      return [NOTES_WORLD_TOPIC, userTopic(ctx.actorId)];
    },
  },
  spaces: {
    // Room subscribe/publish for membership comes from space_users images.
    // Holding a stale spaces row after leave must not keep room:{id}.
    topics(_row, ctx) {
      return [userTopic(ctx.actorId)];
    },
  },
  space_users: {
    topics(row, ctx) {
      const spaceId = String(row['space_id'] ?? '');
      const userId = String(row['user_id'] ?? '');
      return [
        ...(spaceId.length > 0 ? [roomTopic(spaceId)] : []),
        ...(userId.length > 0 ? [userTopic(userId)] : []),
        userTopic(ctx.actorId),
      ];
    },
  },
  // Device-private: writer has the local mutation row; hydrate via
  // openSpaceSessions (device_id filter). Empty topics so row images do not
  // ride sibling spaces/space_users wakes on user:{actor}.
  space_open_sessions: {
    topics() {
      return [];
    },
    fallbackTopics() {
      return [];
    },
  },
});

export function notesDefaultEntryChannel(
  _params: unknown,
  ctx: { readonly actorId: string }
) {
  return [userTopic(ctx.actorId)];
}
