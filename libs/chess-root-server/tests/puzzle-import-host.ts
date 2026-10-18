import { drainAndNotifyOutbox } from '@libs/app-root-server/outbox-drain';
import { BILLING_TABLES } from '@libs/billing-shared/tables';
import {
  startPuzzleImport,
  stopPuzzleImport,
} from '@libs/chess-puzzle-shared/puzzle-import-mutations';
import { puzzleSourcePartKey } from '@libs/chess-puzzle-shared/puzzle-load-job';
import { puzzleImportConsumer } from '@libs/chess-root-server/puzzle-import-consumer';
import { CHESS_TOPIC_MAP } from '@libs/chess-root-shared/topic-map';
import { CHESS_TABLES } from '@libs/chess-sub-shared/chess-tables';
import { PUZZLE_TABLES } from '@libs/game-puzzle-shared/puzzle-tables';
import { PUZZLE_TOPIC_MAP } from '@libs/game-puzzle-shared/puzzle-topic-map';
import { authorizeAppMutation } from '@libs/permissions-shared/authorize-app-mutation';
import { permissionPolicyForPuzzleManagers } from '@libs/permissions-shared/permission-policy';
import { uniqueTables } from '@libs/permissions-shared/world';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres-shared/reconcile-postgres-schema';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';
import { writeUtf8 } from '@pkgs/object-store-root-shared/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import { OutboxConsumerRegistry } from '@pkgs/outbox-shared/define-consumer';
import { drainOutbox } from '@pkgs/outbox-shared/drain';
import { reconcileOutboxPostgres } from '@pkgs/outbox-shared/reconcile';
import sql from '@pkgs/sql-root-shared/sql';
import type {
  Mutation,
  MutationEnv,
} from '@pkgs/sync-engine-shared/mutations-types';
import { syncEngineServerSchema } from '@pkgs/sync-engine-shared/tables';
import { wrapMutationDb } from '@pkgs/sync-engine-shared/wrap-mutation-db';
import { openConcurrentPostgres } from './concurrent-postgres';

const AT = '2026-10-14T12:00:00.000Z';
export const HEADER =
  'PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags,DailyDate';
export const SAMPLE =
  'one,6k1/5p1p/1p4p1/p1bN1p2/2Pq1P2/1P5P/1P1Q2P1/7K w - - 1 32,d2c3 d4g1,1275,112,100,43,mate mateIn1,,,';

export async function openPuzzleImportHost() {
  const postgres = await openConcurrentPostgres('pool');
  try {
    await reconcilePostgresSchema(
      postgres.admin,
      registerTables(
        uniqueTables([...BILLING_TABLES, ...PUZZLE_TABLES, ...CHESS_TABLES])
      ),
      postgres.dbScope
    );
    await reconcilePostgresSchema(
      postgres.admin,
      syncEngineServerSchema,
      postgres.dbScope
    );
    await reconcileOutboxPostgres(postgres.db, {
      dbScope: postgres.dbScope,
      alreadyInTransaction: false,
    });
    await postgres.db.run(sql`INSERT INTO client_config (id, value, created_at, updated_at)
      VALUES ('permission_policy', ${JSON.stringify(permissionPolicyForPuzzleManagers(['manager', 'other-manager']))}, ${AT}, ${AT})`);
    return importHost(postgres);
  } catch (error) {
    await postgres[Symbol.asyncDispose]();
    throw error;
  }
}

function importHost(
  postgres: Awaited<ReturnType<typeof openConcurrentPostgres>>
) {
  const store = new ObjectStoreImplInMemory();
  let id = 0;
  const createId = () => `id-${++id}`;
  const clock = { now: () => Date.parse(AT) };
  const env = (actorId: string): MutationEnv => ({
    actorId,
    accountId: actorId,
    deviceId: 'phone',
    isAnon: false,
    now: () => new Date(AT),
    createId,
  });
  const run = <A>(mutation: Mutation<A>, args: A, actorId = 'manager') =>
    postgres.db.transaction(async (tx) => {
      const mutationEnv = env(actorId);
      const wrapped = wrapMutationDb(tx, mutationEnv).tx;
      await authorizeAppMutation({
        name: mutation.name,
        args,
        tx: wrapped,
        env: mutationEnv,
        serverNow: mutationEnv.now,
      });
      await mutation.run({ tx: wrapped, env: mutationEnv }, args);
    });
  const registry = new OutboxConsumerRegistry();
  registry.register(puzzleImportConsumer);
  const published: { topic: string; data: unknown }[] = [];
  return {
    published,
    drainAndNotify: () =>
      drainAndNotifyOutbox({
        db: postgres.db,
        clock,
        createId,
        consumerRegistry: registry,
        topicMap: { ...PUZZLE_TOPIC_MAP, ...CHESS_TOPIC_MAP },
        objectStore: store,
        pubsub: {
          publish: async (topic, data) => {
            published.push({ topic, data });
          },
          subscribe: () => () => {},
          status: () => 'connected',
          onStatus: () => () => {},
          close() {},
        },
      }),
    ...postgres,
    store,
    env,
    run,
    stage: (uploadId: string, part: number, content: string) =>
      writeUtf8(
        store,
        puzzleSourcePartKey(uploadId, part),
        content,
        'text/csv'
      ),
    start: (uploadId: string, chunks = 1, actorId = 'manager') =>
      run(
        startPuzzleImport,
        { uploadId, sourceId: uploadId, filename: 'lichess.csv', chunks },
        actorId
      ),
    stop: (uploadId: string, actorId = 'manager') =>
      run(stopPuzzleImport, { uploadId }, actorId),
    drain: () =>
      drainOutbox({
        db: postgres.db,
        clock,
        createId,
        registry,
        limit: 1,
        objectStore: store,
        wrapConsumerTx: (tx) => wrapMutationDb(tx, env('manager')).tx,
      }),
    job: async () =>
      (
        await postgres.db.query(
          sql<{
            error: string | null;
            status: string;
          }>`SELECT * FROM chess_puzzle_load WHERE id = 'dataset'`
        )
      )[0],
  };
}
