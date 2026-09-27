import type { TopicMap } from '@pkgs/sync-engine/shared';

export const AUTH_TOPIC_MAP = {
  auth_users: {
    topics(row, ctx) {
      return [`user:${String(row['id'] ?? ctx.actorId)}`];
    },
  },
  auth_devices: {
    topics(_row, ctx) {
      return [`user:${ctx.actorId}`];
    },
  },
  auth_account_devices: {
    topics(row, ctx) {
      return [`user:${String(row['user_id'] ?? ctx.actorId)}`];
    },
  },
  auth_external_accounts: {
    topics(_row, ctx) {
      return [`user:${ctx.actorId}`];
    },
  },
} satisfies TopicMap;
