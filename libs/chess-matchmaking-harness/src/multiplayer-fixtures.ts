import { accountMutationEnv } from '@libs/auth-shared/account-mutation-env';
import { scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { signedInAccountOf } from '@libs/harness/identity';
import sql from '@pkgs/sql-shared/sql';
import type { SqlTx } from '@pkgs/sql-client-shared/interface';
import { notifyChannels } from '@pkgs/sync-engine-server/notify-channels';
import { wrapMutationDb } from '@pkgs/sync-engine-shared/wrap-mutation-db';
import type { MutationEnv } from '@pkgs/sync-engine-shared/mutations-types';
import { formChessMatches } from '@libs/chess-matchmaking-shared/match-handoff';
import { findChessOpponentMutation } from '@libs/chess-matchmaking-shared/find-opponent-mutation';

/** Fixture writes are actual mutation bodies, with normal captured sync pushes. */
export async function multiplayerFixture(
  s: ProductHarness,
  actor: string,
  run: (tx: SqlTx, env: MutationEnv) => Promise<readonly string[]>
): Promise<void> {
  const owner = await signedInAccountOf(s, actor);
  if (owner === null) throw new Error(`Missing ${actor}'s account`);
  await multiplayerTransaction(s, owner, run);
}

/** A server event's trusted subject; independent of a device session. */
export async function multiplayerTransaction(
  s: ProductHarness,
  owner: string,
  run: (tx: SqlTx, env: MutationEnv) => Promise<readonly string[]>
): Promise<void> {
  const base = accountMutationEnv(owner, s.harness.server);
  const env = { ...base, serverNow: base.now };
  let tables: readonly string[] = [];
  const owners = await s.harness.serverSql.sqlClient.transaction(async (tx) => {
    const wrapped = wrapMutationDb(tx, env);
    const affected = await run(wrapped.tx, env);
    tables = wrapped.getCapture().tables;
    return affected;
  });
  const pubsub = s.harness.server.events;
  if (pubsub === null)
    throw new Error('Multiplayer fixture requires the composed pubsub');
  await notifyChannels({
    pubsub,
    sql: s.harness.serverSql.sqlClient,
    tables,
    topics: owners.map((id) => `user:${id}`),
    label: 'multiplayer-fixture',
    now: s.harness.clock.now,
  });
}

export const givenOpponentSearch = scenarioAction<
  [actor: string, requestId?: string]
>({
  name: 'givenOpponentSearch',
  act: (s, actor: string, requestId = s.session.ports.createId()) =>
    multiplayerFixture(s, actor, async (tx, env) => {
      await findChessOpponentMutation.run({ tx, env }, { requestId });
      return [env.actorId];
    }),
});

export const pairChessOpponents = scenarioAction<[actor?: string]>({
  name: 'pairChessOpponents',
  act: (s, actor = 'alice') =>
    multiplayerFixture(s, actor, (tx) =>
      formChessMatches(tx, {
        nowMs: s.harness.clock.now(),
        createId: s.harness.server.createId,
      })
    ),
});

/** A legal pre-existing position; its next move still uses the real command. */
export const givenMultiplayerPosition = scenarioAction({
  name: 'givenMultiplayerPosition',
  act: (s, actor: string, gameId: string, fen: string) =>
    multiplayerFixture(s, actor, async (tx, env) => {
      await tx.run(sql`UPDATE chess_multiplayer_games SET fen = ${fen}, pgn = ${''},
        turn = ${env.actorId}, updated_at = ${env.now().toISOString()} WHERE id = ${gameId}`);
      return (
        await tx.query(
          sql<{
            white_id: string;
            black_id: string;
          }>`SELECT white_id, black_id FROM chess_multiplayer_games WHERE id = ${gameId}`
        )
      ).flatMap((game) => [game.white_id, game.black_id]);
    }),
});
