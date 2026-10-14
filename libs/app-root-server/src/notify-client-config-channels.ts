import { clientConfigTopic } from '@libs/app-config-shared/sync-topics';
import { apiRequestAsyncLocalStorage } from '@libs/app-root-shared/request-scope';
import { HttpPubSubFromSecretStore } from '@libs/pubsub-server/create-http-pubsub-from-secret-store';
import { notifyChannels } from '@pkgs/sync-engine-server/notify-channels';

/** Best-effort system-topic push after client_config DOMAIN write. */
export async function notifyClientConfigChannels(label: string): Promise<void> {
  const store = apiRequestAsyncLocalStorage.getStore();
  if (store === undefined) return;
  const pubsub = await new HttpPubSubFromSecretStore(
    store.secretStore,
    () => store.clock.now(),
    store.http
  ).get();
  if (pubsub === undefined) return;
  await notifyChannels({
    pubsub,
    sql: store.sqlClient,
    topics: [clientConfigTopic()],
    label,
    now: () => store.clock.now(),
    schedulePublish: (run) => {
      store.timers.setTimeout(run, 0);
    },
  });
}
