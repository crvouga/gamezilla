import { userTopic } from '@libs/db/shared/sync-topics';
import { notifyChannels } from '@pkgs/sync-engine/server';

import { apiRequestAsyncLocalStorage } from '../request-scope';
import { getApiPubSub } from './api-pubsub';

/** Best-effort user-topic push after a non-replay DOMAIN write. */
export async function notifyUserChannels(
  userIds: readonly string[],
  label: string,
  tables?: readonly string[]
): Promise<void> {
  const store = apiRequestAsyncLocalStorage.getStore();
  if (store === undefined) return;
  const topics = userIds
    .filter((id) => id.length > 0)
    .map((id) => userTopic(id));
  if (topics.length === 0) return;
  const pubsub = await getApiPubSub(store.secretStore);
  if (pubsub === undefined) return;
  await notifyChannels({
    pubsub,
    sql: store.sqlClient,
    topics,
    ...(tables !== undefined && tables.length > 0 ? { tables } : {}),
    label,
  });
}
