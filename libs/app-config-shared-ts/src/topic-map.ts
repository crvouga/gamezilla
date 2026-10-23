import type { TopicMap } from '@pkgs/sync-engine-shared-ts/topic-map';
import { clientConfigTopic } from './sync-topics';

export const CLIENT_CONFIG_TOPIC_MAP = {
  client_config: {
    topics() {
      return [clientConfigTopic()];
    },
    fallbackTopics() {
      return [clientConfigTopic()];
    },
  },
} satisfies TopicMap;
