import { userTopic } from '@libs/feature/public/sync';
import { HttpPubSubFromSecretStore } from '@libs/pubsub/root/server/create-http-pubsub-from-secret-store';
import { notifyChannels } from '@pkgs/sync-engine/server';
import { apiRequestAsyncLocalStorage } from '../request-scope';

export type NotifyUserChannelsOptions = {
  readonly tables?: readonly string[];
  /**
   * When true, publish on the request timers after allocate (avoids re-entering
   * an open Hono/mockingbird-postgres request). Prefer false for OOB paths that already
   * finished their write txn — DST harnesses need the push before the next tick.
   */
  readonly deferPublish?: boolean;
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
  const pubsub = await new HttpPubSubFromSecretStore(store.secretStore, () =>
    store.clock.now()
  ).get();
  if (pubsub === undefined) return;
  const tables = options.tables;
  const deferPublish = options.deferPublish !== false;
  await notifyChannels({
    pubsub,
    sql: store.sqlClient,
    topics,
    ...(tables !== undefined && tables.length > 0 ? { tables } : {}),
    label,
    now: () => store.clock.now(),
    ...(deferPublish
      ? {
          schedulePublish: (run: () => void) => {
            store.timers.setTimeout(run, 0);
          },
        }
      : {}),
  });
}
