import { clientConfigTopic } from '@libs/db/shared/sync-topics';
import { notifyChannels } from '@pkgs/sync-engine/server';

import { apiRequestAsyncLocalStorage } from '../request-scope';
import { getApiPubSub } from './api-pubsub';

/** Best-effort system-topic push after client_config DOMAIN write. */
export function notifyClientConfigChannels(label: string): void {
  const store = apiRequestAsyncLocalStorage.getStore();
  if (store === undefined) return;
  void (async () => {
    const pubsub = await getApiPubSub(store.secretStore);
    if (pubsub === undefined) return;
    notifyChannels({
      pubsub,
      sql: store.sqlClient,
      topics: [clientConfigTopic()],
      label,
    });
  })();
}
