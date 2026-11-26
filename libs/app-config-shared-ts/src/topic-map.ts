import type { TopicMap } from '@pkgs/sync-engine-shared-ts/topic-map';
import { ClientConfigKey } from './client-config-keys';
import { clientConfigTopic } from './sync-topics';

export const CLIENT_CONFIG_TOPIC_MAP = {
  client_config: {
    rowImage: {
      publish: (row) => row['id'] !== ClientConfigKey.permissionPolicy,
    },
    topics() {
      return [clientConfigTopic()];
    },
    fallbackTopics() {
      return [clientConfigTopic()];
    },
  },
} satisfies TopicMap;
