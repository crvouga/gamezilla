import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { partitionFanoutRowsByTopic } from '@pkgs/sync-engine-shared-ts/partition-fanout-rows';
import { filterPublishableImages } from '@pkgs/sync-engine-shared-ts/row-image-guard';
import {
  fanoutRowsForCapture,
  mergeAffectedRows,
} from '@pkgs/sync-engine-shared-ts/select-fanout-rows';
import type {
  TopicMap,
  TopicMapCtx,
} from '@pkgs/sync-engine-shared-ts/topic-map';
import {
  topicMapCtxFromEnv,
  topicsFromWriteCapture,
} from '@pkgs/sync-engine-shared-ts/topic-map';
import type { QueryRow } from '@pkgs/sync-engine-shared-ts/v2';
import type { WriteCaptureSnapshot } from '@pkgs/sync-engine-shared-ts/write-capture';
import { allocateTopicPushSeqs } from './allocate-topic-push-seq';

function mergeCaptures(
  captures: readonly WriteCaptureSnapshot[]
): WriteCaptureSnapshot {
  const tables = new Set<string>();
  const imagesByTable = new Map<string, Map<string, QueryRow>>();
  for (const capture of captures) {
    for (const table of capture.tables) tables.add(table);
    for (const [table, rows] of Object.entries(capture.images)) {
      let byId = imagesByTable.get(table);
      if (byId === undefined) {
        byId = new Map();
        imagesByTable.set(table, byId);
      }
      for (const row of rows) {
        const id = String(row['id'] ?? '');
        // The last mutation to write this id owns its published post-image.
        if (id.length > 0) byId.set(id, { ...row });
      }
    }
  }
  const images: Record<string, QueryRow[]> = {};
  for (const [table, rows] of imagesByTable) images[table] = [...rows.values()];
  return {
    tables: [...tables].sort(),
    ids: mergeAffectedRows(captures.map((capture) => capture.ids)),
    images,
  };
}

export async function prepareMutationPush(args: {
  readonly db: SqlClient;
  readonly auth: TopicMapCtx;
  readonly captures: readonly WriteCaptureSnapshot[];
  readonly topicMap: TopicMap | undefined;
  readonly rowImageFanout: boolean;
  readonly now: () => number;
}) {
  const { db, topicMap } = args;
  const capture = mergeCaptures(args.captures);
  const ctx = topicMapCtxFromEnv(args.auth);
  const topics =
    topicMap === undefined
      ? []
      : await topicsFromWriteCapture({ topicMap, capture, ctx, db });
  const rows = args.rowImageFanout
    ? await fanoutRowsForCapture(db, capture)
    : undefined;
  // One veto requires the whole batch to refetch through authorized queries.
  const publishImages =
    rows !== undefined && filterPublishableImages(rows, topicMap, ctx) === rows;
  const images = !publishImages
    ? {}
    : topicMap === undefined
      ? { rows }
      : {
          rowsByTopic: await partitionFanoutRowsByTopic({
            topicMap,
            ctx,
            rows,
            db,
          }),
        };
  const pushSeqs = await allocateTopicPushSeqs(db, topics, args.now);
  return { tables: capture.tables, pushSeqs, ...images };
}
