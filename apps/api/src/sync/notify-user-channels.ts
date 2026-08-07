import { userTopic } from '@libs/db/shared/sync-topics';
import { notifyChannels } from '@pkgs/sync-engine/server';

import { apiRequestAsyncLocalStorage } from '../request-scope';
import { getApiPubSub } from './api-pubsub';

/** Best-effort user-topic nudge after a non-replay DOMAIN write. */
export function notifyUserChannels(
  userIds: readonly string[],
  label: string,
  tables?: readonly string[]
): void {
  const store = apiRequestAsyncLocalStorage.getStore();
  if (store === undefined) return;
  void getApiPubSub(store.secretStore).then((pubsub) => {
    if (pubsub === undefined) return;
    notifyChannels({
      pubsub,
      topics: userIds.filter((id) => id.length > 0).map((id) => userTopic(id)),
      checkpoint: `${Date.now()}000000`,
      ...(tables !== undefined && tables.length > 0 ? { tables } : {}),
      label,
    });
  });
}
