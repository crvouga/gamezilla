import { userTopic } from '@libs/sub-shared-ts/sync';
import type { Topic } from '@pkgs/pubsub-root-shared-ts/topic';
import { partitionFanoutRowsByTopic } from '@pkgs/sync-engine-shared-ts/partition-fanout-rows';
import { filterPublishableImages } from '@pkgs/sync-engine-shared-ts/row-image-guard';
import { fanoutRowsWithinCap } from '@pkgs/sync-engine-shared-ts/select-fanout-rows';
import type { QueryRow } from '@pkgs/sync-engine-shared-ts/v2';
import { outboxNotificationTopics } from './outbox-notification-topics';

type NotificationArgs = Parameters<typeof outboxNotificationTopics>[0];
type NotificationPlan = {
  readonly topics: readonly Topic[];
  readonly rowsByTopic?: ReadonlyMap<Topic, Record<string, QueryRow[]>>;
};

/** Captured post-images only; an unknown or vetoed image keeps invalidation-only fanout. */
function publishableRows(
  args: NotificationArgs
): Record<string, QueryRow[]> | undefined {
  if (args.topicMap === undefined) return undefined;
  const rows: Record<string, QueryRow[]> = {};
  for (const capture of args.captures) {
    for (const table of capture.tables) {
      if (args.topicMap[table] === undefined) continue;
      const images = capture.images[table];
      if (images === undefined) return undefined;
      const byId = new Map(
        (rows[table] ?? []).map((row) => [String(row['id']), row])
      );
      for (const image of images) byId.set(String(image['id']), image);
      rows[table] = [...byId.values()];
    }
  }
  if (!fanoutRowsWithinCap(rows)) return undefined;
  return filterPublishableImages(rows, args.topicMap, args.ctx) === rows
    ? rows
    : undefined;
}

/** Use the same publication guards and row-to-topic routing as mutation fanout. */
export async function outboxNotificationPlan(
  args: NotificationArgs
): Promise<NotificationPlan> {
  const rows = publishableRows(args);
  if (rows === undefined || args.topicMap === undefined)
    return { topics: await outboxNotificationTopics(args) };
  const rowsByTopic = await partitionFanoutRowsByTopic({
    topicMap: args.topicMap,
    ctx: args.ctx,
    rows,
    db: args.db,
  });
  const topics = new Set<Topic>(
    args.notifyUserIds.filter((id) => id.length > 0).map(userTopic)
  );
  for (const topic of rowsByTopic.keys()) topics.add(topic);
  return { topics: [...topics].sort(), rowsByTopic };
}
