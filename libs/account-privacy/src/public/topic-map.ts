import type { TopicMap } from '@pkgs/sync-engine/shared';

export const ACCOUNT_PRIVACY_TOPIC_MAP = {
  profile_deletion_receipts: {
    topics(row, ctx) {
      return [`user:${String(row['owner_id'] ?? ctx.actorId)}`];
    },
    fallbackTopics(ctx) {
      return [`user:${ctx.actorId}`];
    },
    rowImage: { publish: () => false },
  },
  profile_account_privacy: {
    topics(row, ctx) {
      return [`user:${String(row['owner_id'] ?? ctx.actorId)}`];
    },
    fallbackTopics(ctx) {
      return [`user:${ctx.actorId}`];
    },
    rowImage: { publish: () => false },
  },
} satisfies TopicMap;
