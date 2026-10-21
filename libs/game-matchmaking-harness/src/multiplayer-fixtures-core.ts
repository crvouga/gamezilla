import { drainAndNotifyOutbox } from '@libs/app-root-server/outbox-drain';
import { accountMutationEnv } from '@libs/auth-shared/account-mutation-env';
import { MultiplayerGameChanged } from '@libs/game-matchmaking-shared/match-room';
import { MultiplayerNoticesDue } from '@libs/game-matchmaking-shared/multiplayer-notices';
import type { ProductHarness } from '@libs/harness/harness';
import { signedInAccountOf } from '@libs/harness/identity';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql, { join } from '@pkgs/sql-root-shared/sql';
import { notifyChannels } from '@pkgs/sync-engine-server/notify-channels';
import type { MutationEnv } from '@pkgs/sync-engine-shared/mutations-types';
import { wrapMutationDb } from '@pkgs/sync-engine-shared/wrap-mutation-db';

/**
 * A fixture's write as the server makes it, in one transaction: its board
 * reaches the match room and its people's devices as a real command's does.
 */
export async function multiplayerFixture(
  s: ProductHarness,
  actor: string,
  run: (tx: SqlTx, env: MutationEnv) => Promise<readonly string[]>
): Promise<void> {
  const owner = await signedInAccountOf(s, actor);
  if (owner === null) throw new Error(`Missing ${actor}'s account`);
  await multiplayerTransaction(s, owner, run);
}

/** Both people of every game written, as the production topic map wakes them. */
function gamePlayers(
  images: Readonly<Record<string, readonly Record<string, unknown>[]>>
): string[] {
  return (images['chess_multiplayer_games'] ?? []).flatMap((row) =>
    [row['white_id'], row['black_id']].filter(
      (id): id is string => typeof id === 'string' && id.length > 0
    )
  );
}

/**
 * What a game write sets off at once in production, where the request that
 * wrote it drains them: the room's board and a daily game's notices.
 */
const DELIVERED_AT_ONCE = [
  MultiplayerGameChanged.type,
  MultiplayerNoticesDue.type,
] as const;

/** A server event's trusted subject; independent of a device session. */
export async function multiplayerTransaction(
  s: ProductHarness,
  owner: string,
  run: (tx: SqlTx, env: MutationEnv) => Promise<readonly string[]>
): Promise<void> {
  const base = accountMutationEnv(owner, s.harness.server);
  const env = {
    ...base,
    serverNow: base.now,
    turnGames: s.harness.composition.app.turnGames,
  };
  let tables: readonly string[] = [];
  const owners = await s.harness.serverSql.sqlClient.transaction(async (tx) => {
    const wrapped = wrapMutationDb(tx, env);
    const affected = await run(wrapped.tx, env);
    const capture = wrapped.getCapture();
    tables = capture.tables;
    return [...new Set([...affected, ...gamePlayers(capture.images)])];
  });
  const pubsub = s.harness.server.events;
  if (pubsub === null)
    throw new Error('Multiplayer fixture requires the composed pubsub');
  const matchEvents = await s.harness.serverSql.sqlClient.query(
    sql<{
      id: string;
    }>`SELECT id FROM outbox_events WHERE type IN (${join([...DELIVERED_AT_ONCE])}) AND deleted_at IS NULL`
  );
  if (matchEvents.length > 0)
    await drainAndNotifyOutbox({
      db: s.harness.serverSql.sqlClient,
      clock: s.harness.clock,
      createId: s.session.ports.createId,
      pubsub,
      objectStore: s.harness.server.blob,
      consumerRegistry: s.harness.outboxConsumers(),
      eventIds: matchEvents.map((event) => event.id),
    });
  await notifyChannels({
    pubsub,
    sql: s.harness.serverSql.sqlClient,
    tables,
    topics: owners.map((id) => `user:${id}`),
    label: 'multiplayer-fixture',
    now: s.harness.clock.now,
  });
}
