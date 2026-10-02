import type { Topic } from '@pkgs/pubsub/interface';
import type { TopicMap } from '@pkgs/sync-engine/shared';

export const BILLING_TOPIC_MAP = {
  billing_account_closures: {
    topics(row, ctx) {
      return [`user:${String(row['account_id'] ?? ctx.actorId)}`];
    },
    rowImage: { publish: () => false },
  },
  billing_payment_evidence: {
    topics(row, ctx) {
      return [`user:${String(row['account_id'] ?? ctx.actorId)}`];
    },
    rowImage: { publish: () => false },
  },
  billing_subscriptions: {
    topics(row, ctx): Topic[] {
      const account = String(row['account_id'] ?? ctx.actorId);
      return account.length > 0 ? [`user:${account}` as Topic] : [];
    },
  },
} satisfies TopicMap;
