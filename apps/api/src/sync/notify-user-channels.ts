import { notifyChannels } from '@pkgs/sync-engine/server/notify-channels';
import { userTopic } from '@libs/db/shared/sync-topics';

import { apiRequestAsyncLocalStorage } from '../request-scope';
import { getApiPubSub } from './api-pubsub';

/** Best-effort user-topic nudge after a non-replay DOMAIN write. */
export function notifyUserChannels(
  userIds: readonly string[],
  label: string
): void {
  const store = apiRequestAsyncLocalStorage.getStore();
  if (store === undefined) return;
  void getApiPubSub(store.secretStore).then((pubsub) => {
    if (pubsub === undefined) return;
    notifyChannels({
      pubsub,
      topics: userIds.filter((id) => id.length > 0).map((id) => userTopic(id)),
      label,
    });
  });
}
