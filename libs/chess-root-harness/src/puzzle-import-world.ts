import { drainAndNotifyOutbox } from '@libs/app-root-server/outbox-drain';
import { puzzleImportConsumer } from '@libs/chess-root-server/puzzle-import-consumer';
import { CHESS_TOPIC_MAP } from '@libs/chess-root-shared/topic-map';
import { GAME_PUZZLE_SUB } from '@libs/game-puzzle-shared/sub';
import { scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { accountIdOf } from '@libs/harness/identity';
import { permissionPolicyForPuzzleManagers } from '@libs/permissions-shared/permission-policy';
import { readUtf8, writeUtf8 } from '@pkgs/object-store-root-shared/helpers';
import { OutboxConsumerRegistry } from '@pkgs/outbox-shared/define-consumer';
import sql from '@pkgs/sql-root-shared/sql';
import { notifyChannels } from '@pkgs/sync-engine-server/notify-channels';

export const joinPuzzleTeam = scenarioAction({
  name: 'joinPuzzleTeam',
  act: async (s, actor: string) => {
    const accountId = await accountIdOf(s, actor);
    if (accountId === null) throw new Error('Puzzle manager needs an account');
    await s.harness.setPuzzleManagers([
      ...(s.harness.serverEnv(s.harness.serverIds()[0] ?? '')
        ?.puzzleManagerAccountIds ?? []),
      accountId,
    ]);
    const roster =
      s.harness.serverEnv(s.harness.serverIds()[0] ?? '')
        ?.puzzleManagerAccountIds ?? [];
    await s.harness.serverSql.sqlClient.run(
      sql`UPDATE client_config SET value = ${JSON.stringify(permissionPolicyForPuzzleManagers(roster))} WHERE id = 'permission_policy'`
    );
    if (s.harness.server.events)
      await notifyChannels({
        pubsub: s.harness.server.events,
        sql: s.harness.serverSql.sqlClient,
        topics: ['system:client_config'],
        label: 'harness-puzzle-team',
        now: s.harness.clock.now,
      });
  },
});

export const advancePuzzleImport = scenarioAction({
  name: 'advancePuzzleImport',
  act: async (s) => {
    const job = (
      await s.harness.serverSql.sqlClient.query(
        sql<{
          source_etag: string;
          completed_chunks: number;
        }>`SELECT source_etag, completed_chunks FROM chess_puzzle_load WHERE id = 'dataset' AND status = 'adding'`
      )
    )[0];
    if (!job) return;
    const registry = new OutboxConsumerRegistry();
    registry.register(puzzleImportConsumer);
    await drainAndNotifyOutbox({
      db: s.harness.serverSql.sqlClient,
      clock: s.harness.clock,
      createId: s.harness.server.createId,
      pubsub: s.harness.server.events,
      objectStore: s.harness.server.blob,
      consumerRegistry: registry,
      topicMap: { ...GAME_PUZZLE_SUB.topicMap, ...CHESS_TOPIC_MAP },
      eventIds: [
        `puzzle-import:${job.source_etag}:${String(job.completed_chunks)}`,
      ],
      maxPasses: 1,
      limit: 1,
    });
  },
});

export const finishPuzzleImport = scenarioAction({
  name: 'finishPuzzleImport',
  act: async (s) => {
    await Promise.resolve(advancePuzzleImport.act(s));
    await Promise.resolve(advancePuzzleImport.act(s));
  },
});

export const failPuzzleImport = scenarioAction({
  name: 'failPuzzleImport',
  act: async (s) => {
    const job = (
      await s.harness.serverSql.sqlClient.query(
        sql<{
          requested_by: string;
          object_key: string;
          source_etag: string;
          completed_chunks: number;
        }>`SELECT requested_by, object_key, source_etag, completed_chunks FROM chess_puzzle_load WHERE id = 'dataset'`
      )
    )[0];
    if (!job) throw new Error('No import to interrupt');
    // Temporary external unavailability: the real worker records the failure,
    // then the same saved bytes become available for a later load.
    const key = `${job.object_key.slice(0, job.object_key.lastIndexOf('/') + 1)}${String(job.completed_chunks)}.csv`;
    const source = await readUtf8(s.harness.server.blob, key);
    await s.harness.server.blob.delete(key);
    try {
      await Promise.resolve(advancePuzzleImport.act(s));
    } finally {
      if (source !== null)
        await writeUtf8(s.harness.server.blob, key, source, 'text/csv');
    }
  },
});

export async function readImportPool(s: ProductHarness): Promise<number> {
  const rows = await s.harness.serverSql.sqlClient.query(
    sql<{
      count: number;
    }>`SELECT count(*) AS count FROM chess_puzzles WHERE deleted_at IS NULL`
  );
  return Number(rows[0]?.count ?? 0);
}
