import type { TopicMap } from '@pkgs/sync-engine-shared-ts/topic-map';

function usernameNonEmpty(row: Record<string, unknown>): boolean {
  const username = row['username'];
  return typeof username === 'string' && username.length > 0;
}

export const PROFILE_TOPIC_MAP = {
  profile: {
    topics(row, ctx) {
      const id = String(row['id'] ?? ctx.actorId);
      return [`user:${id}`];
    },
    subscribeTopics(row, ctx) {
      const id = String(row['id'] ?? ctx.actorId);
      return [`user:${id}`];
    },
    fallbackTopics(ctx) {
      return [`user:${ctx.actorId}`];
    },
    rowImage: {
      publish(row) {
        return usernameNonEmpty(row);
      },
    },
  },
} satisfies TopicMap;
