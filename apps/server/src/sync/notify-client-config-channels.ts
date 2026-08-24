import { clientConfigTopic } from '@libs/client-config/public/sync-topics';
import { notifyChannels } from '@pkgs/sync-engine/server';

import { apiRequestAsyncLocalStorage } from '../request-scope';
import { HttpPubSubFromSecretStore } from '@libs/pubsub/root/server/create-http-pubsub-from-secret-store';

/** Best-effort system-topic push after client_config DOMAIN write. */
export async function notifyClientConfigChannels(label: string): Promise<void> {
  const store = apiRequestAsyncLocalStorage.getStore();
  if (store === undefined) return;
  const pubsub = await new HttpPubSubFromSecretStore(store.secretStore).get();
  if (pubsub === undefined) return;
  await notifyChannels({
    pubsub,
    sql: store.sqlClient,
    topics: [clientConfigTopic()],
    label,
    schedulePublish: (run) => {
      store.timers.setTimeout(run, 0);
    },
  });
}
