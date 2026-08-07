import { userTopic } from '@libs/db/shared/sync-topics';
import {
  allocateTopicPushSeqs,
  notifyChannels,
} from '@pkgs/sync-engine/server';

import { apiRequestAsyncLocalStorage } from '../request-scope';
import { getApiPubSub } from './api-pubsub';

/** Best-effort user-topic push after a non-replay DOMAIN write. */
export function notifyUserChannels(
  userIds: readonly string[],
  label: string,
  tables?: readonly string[]
): void {
  const store = apiRequestAsyncLocalStorage.getStore();
  if (store === undefined) return;
  const topics = userIds
    .filter((id) => id.length > 0)
    .map((id) => userTopic(id));
  if (topics.length === 0) return;
  void (async () => {
    const pubsub = await getApiPubSub(store.secretStore);
    if (pubsub === undefined) return;
    const pushSeqs = await allocateTopicPushSeqs(store.sqlClient, topics);
    for (const topic of topics) {
      const pushSeq = pushSeqs.get(topic);
      if (pushSeq === undefined) continue;
      notifyChannels({
        pubsub,
        topics: [topic],
        pushSeq,
        ...(tables !== undefined && tables.length > 0 ? { tables } : {}),
        label,
      });
    }
  })();
}
