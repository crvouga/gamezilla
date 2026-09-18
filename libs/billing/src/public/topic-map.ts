import type { Topic } from '@pkgs/pubsub/interface';
import type { TopicMap } from '@pkgs/sync-engine/shared';

export const BILLING_TOPIC_MAP = {
  billing_subscriptions: {
    topics(row): Topic[] {
      const account = String(row['account_id'] ?? '');
      return account.length > 0 ? [`user:${account}` as Topic] : [];
    },
  },
} satisfies TopicMap;
