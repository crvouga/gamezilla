import { apiRequestAsyncLocalStorage } from '@libs/app-root-shared/request-scope';
import { HttpPubSubFromSecretStore } from '@libs/pubsub-server/create-http-pubsub-from-secret-store';
import { userTopic } from '@libs/sub-shared/sync';
import { notifyChannels } from '@pkgs/sync-engine-server/notify-channels';

export type NotifyUserChannelsOptions = {
  readonly tables?: readonly string[];
};

/** Best-effort user-topic push after a non-replay DOMAIN write. */
export async function notifyUserChannels(
  userIds: readonly string[],
  label: string,
  options: NotifyUserChannelsOptions = {}
): Promise<void> {
  const store = apiRequestAsyncLocalStorage.getStore();
  if (store === undefined) return;
  const topics = userIds
    .filter((id) => id.length > 0)
    .map((id) => userTopic(id));
  if (topics.length === 0) return;
  const pubsub = await new HttpPubSubFromSecretStore(
    store.secretStore,
    () => store.clock.now(),
    store.http
  ).get();
  if (pubsub === undefined) return;
  const tables = options.tables;
  await notifyChannels({
    pubsub,
    sql: store.sqlClient,
    topics,
    ...(tables !== undefined && tables.length > 0 ? { tables } : {}),
    label,
    now: () => store.clock.now(),
  });
}
