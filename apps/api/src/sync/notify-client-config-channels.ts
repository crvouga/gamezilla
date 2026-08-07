import { clientConfigTopic } from '@libs/db/shared/sync-topics';
import { allocateTopicPushSeq, notifyChannels } from '@pkgs/sync-engine/server';

import { apiRequestAsyncLocalStorage } from '../request-scope';
import { getApiPubSub } from './api-pubsub';

/** Best-effort system-topic push after client_config DOMAIN write. */
export function notifyClientConfigChannels(label: string): void {
  const store = apiRequestAsyncLocalStorage.getStore();
  if (store === undefined) return;
  void (async () => {
    const pubsub = await getApiPubSub(store.secretStore);
    if (pubsub === undefined) return;
    const topic = clientConfigTopic();
    const pushSeq = await allocateTopicPushSeq(store.sqlClient, topic);
    notifyChannels({
      pubsub,
      topics: [topic],
      pushSeq,
      label,
    });
  })();
}
