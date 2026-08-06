import { clientConfigTopic } from '@libs/db/shared/sync-topics';
import { notifyChannels } from '@pkgs/sync-engine/server/notify-channels';

import { apiRequestAsyncLocalStorage } from '../request-scope';
import { getApiPubSub } from './api-pubsub';

/** Best-effort system-topic nudge after client_config DOMAIN write. */
export function notifyClientConfigChannels(label: string): void {
  const store = apiRequestAsyncLocalStorage.getStore();
  if (store === undefined) return;
  void getApiPubSub(store.secretStore).then((pubsub) => {
    if (pubsub === undefined) return;
    notifyChannels({
      pubsub,
      topics: [clientConfigTopic()],
      label,
    });
  });
}
