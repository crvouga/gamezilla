import { userTopic } from '@libs/sub-shared/sync';
import type { Topic } from '@pkgs/pubsub-root-shared/topic';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import {
  type TopicMap,
  type TopicMapCtx,
  topicsFromWriteCapture,
} from '@pkgs/sync-engine-shared/topic-map';
import type { WriteCaptureSnapshot } from '@pkgs/sync-engine-shared/write-capture';

/** Background writes use the same row-derived destinations as mutation replay. */
export async function outboxNotificationTopics(args: {
  topicMap: TopicMap | undefined;
  captures: readonly WriteCaptureSnapshot[];
  notifyUserIds: readonly string[];
  db: SqlClient;
  ctx: TopicMapCtx;
}): Promise<Topic[]> {
  const topics = new Set<Topic>(
    args.notifyUserIds.filter((id) => id.length > 0).map(userTopic)
  );
  if (args.topicMap === undefined) return [...topics];
  for (const capture of args.captures) {
    const derived = await topicsFromWriteCapture({
      topicMap: args.topicMap,
      capture,
      db: args.db,
      ctx: args.ctx,
    });
    for (const topic of derived) topics.add(topic);
  }
  return [...topics].sort();
}
