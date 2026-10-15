import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import type { Sql } from '@pkgs/sql-root-shared/sql';
import { notifyChannels } from '@pkgs/sync-engine-server/notify-channels';
import { classify } from '@pkgs/sync-engine-shared/classify';
import type { TopicMap } from '@pkgs/sync-engine-shared/topic-map';
import { topicsFromWriteCapture } from '@pkgs/sync-engine-shared/topic-map';
import type { WriteCaptureBag } from '@pkgs/sync-engine-shared/write-capture';
import { createWriteCaptureBag } from '@pkgs/sync-engine-shared/write-capture';
import type { ProductHarness } from './harness';

/** Keep the seeder's SQL results intact while capturing its write tables. */
function captureClient(db: SqlClient, capture: WriteCaptureBag): SqlClient {
  const record = (query: Sql<unknown>) => {
    const statement = classify(query);
    if (statement.kind === 'write') capture.touch(statement.table);
  };
  return {
    connect: () => db.connect(),
    disconnect: () => db.disconnect(),
    query: async (query) => {
      const result = await db.query(query);
      record(query);
      return result;
    },
    run: async (query) => {
      const result = await db.run(query);
      record(query);
      return result;
    },
    prepare: (query) => {
      const statement = db.prepare(query);
      return {
        query: async (params) => {
          const result = await statement.query(params);
          record(query);
          return result;
        },
        run: async (params) => {
          const result = await statement.run(params);
          record(query);
          return result;
        },
      };
    },
    transaction: (body) =>
      db.transaction((tx) => body(captureClient(tx, capture))),
  };
}

/** Server fixtures publish committed writes through the owning topic map. */
export async function writeServerFixture(
  s: ProductHarness,
  topicMap: TopicMap,
  write: (db: SqlClient) => Promise<void>
): Promise<void> {
  const pubsub = s.harness.server.events;
  if (pubsub === null) throw new Error('Server fixture needs pubsub');
  const db = s.harness.serverSql.sqlClient;
  const capture = createWriteCaptureBag();
  await write(captureClient(db, capture));
  const snapshot = capture.snapshot();
  await notifyChannels({
    pubsub,
    sql: db,
    topics: await topicsFromWriteCapture({
      topicMap,
      capture: snapshot,
      // Server-authored fixtures have no acting device or account.
      ctx: {
        actorId: 'server-fixture',
        deviceId: 'server-fixture',
        accountId: null,
        isAnon: false,
      },
    }),
    tables: snapshot.tables,
    now: s.harness.clock.now,
    label: 'server-fixture',
  });
}
