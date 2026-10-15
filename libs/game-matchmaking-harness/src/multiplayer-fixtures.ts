import { drainAndNotifyOutbox } from '@libs/app-root-server/outbox-drain';
import { accountMutationEnv } from '@libs/auth-shared/account-mutation-env';
import { findOpponentMutation } from '@libs/game-matchmaking-shared/find-opponent-mutation';
import { MultiplayerGameRepository } from '@libs/game-matchmaking-shared/game-repository';
import { formGameMatches } from '@libs/game-matchmaking-shared/match-handoff';
import { MultiplayerGameChanged } from '@libs/game-matchmaking-shared/match-room';
import { scheduleMultiplayerDeadline } from '@libs/game-matchmaking-shared/multiplayer-deadline';
import { MultiplayerNoticesDue } from '@libs/game-matchmaking-shared/multiplayer-notices';
import { publishMatchGame } from '@libs/game-matchmaking-shared/publish-match-game';
import { MultiplayerRatingRepository } from '@libs/game-matchmaking-shared/rating-repository';
import { OPPONENT_SEARCH_RADIUS } from '@libs/game-matchmaking-shared/search-config';
import type { MultiplayerSpeed } from '@libs/game-matchmaking-shared/time-control';
import { scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { signedInAccountOf } from '@libs/harness/identity';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql, { join } from '@pkgs/sql-root-shared/sql';
import { notifyChannels } from '@pkgs/sync-engine-server/notify-channels';
import type { MutationEnv } from '@pkgs/sync-engine-shared/mutations-types';
import { wrapMutationDb } from '@pkgs/sync-engine-shared/wrap-mutation-db';
import { multiplayerSpaceId } from './multiplayer-spaces';

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

export const givenOpponentSearch = scenarioAction<
  [actor: string, timeControl: string, requestId?: string]
>({
  name: 'givenOpponentSearch',
  act: (
    s,
    actor: string,
    timeControl: string,
    requestId = s.session.ports.createId()
  ) =>
    multiplayerFixture(s, actor, async (tx, env) => {
      const spaceId = await multiplayerSpaceId(s, actor);
      await findOpponentMutation.run(
        { tx, env },
        { requestId, timeControl, spaceId: spaceId ?? 'no-space' }
      );
      return [env.actorId];
    }),
});

/**
 * The formation pass. `firstIsWhite` fixes the chance that settles equal
 * colour balances, for a setup that names the colours.
 */
export const pairGameOpponents = scenarioAction<
  [actor?: string, firstIsWhite?: boolean]
>({
  name: 'pairGameOpponents',
  act: (s, actor = 'alice', firstIsWhite?: boolean) =>
    multiplayerFixture(s, actor, (tx) =>
      formGameMatches(
        tx,
        {
          nowMs: s.harness.clock.now(),
          createId: s.harness.server.createId,
          ...(firstIsWhite === undefined
            ? {}
            : { tieBreak: () => firstIsWhite }),
        },
        s.harness.composition.app.turnGames
      )
    ),
});

/** The changed game keeps its deadline for the scheduled sweep, as every write does. */
/** The longest a search waits before its range reaches the maximum. */
const LONGEST_RANGE_WAIT_MS =
  ((OPPONENT_SEARCH_RADIUS.maxRadius - OPPONENT_SEARCH_RADIUS.baseRadius) /
    OPPONENT_SEARCH_RADIUS.radiusGrowthPerSecond) *
    1000 +
  1000;

/**
 * Matchmaking forms the match of these two waiting people as soon as their
 * growing ranges allow: a formation pass each second until it does.
 */
export const awaitGameMatch = scenarioAction<
  [first: string, second: string, firstIsWhite?: boolean]
>({
  name: 'awaitGameMatch',
  act: async (s, first: string, second: string, firstIsWhite?: boolean) => {
    const people = [
      await signedInAccountOf(s, first),
      await signedInAccountOf(s, second),
    ];
    for (let waited = 0; waited <= LONGEST_RANGE_WAIT_MS; waited += 1000) {
      let formed: readonly string[] = [];
      await multiplayerFixture(s, first, async (tx) => {
        formed = await formGameMatches(
          tx,
          {
            nowMs: s.harness.clock.now(),
            createId: s.harness.server.createId,
            ...(firstIsWhite === undefined
              ? {}
              : { tieBreak: () => firstIsWhite }),
          },
          s.harness.composition.app.turnGames
        );
        return formed;
      });
      if (people.every((id) => id !== null && formed.includes(id))) return;
      await s.session.advanceTime(1000);
    }
    throw new Error(`No game match formed for ${first} and ${second}`);
  },
});

/** Deliver a fixture's accepted board and clocks through the production outbox. */
export async function publishMultiplayerFixture(
  tx: SqlTx,
  gameId: string,
  env: MutationEnv
) {
  const game = await new MultiplayerGameRepository(tx).byId(gameId);
  if (game === null) throw new Error(`No multiplayer game ${gameId}`);
  await publishMatchGame({ tx, env }, game);
  await scheduleMultiplayerDeadline(tx, game, env.now().getTime());
  return [game.white_id, game.black_id];
}

/**
 * A legal pre-existing position after both first moves, the actor to move,
 * with this much time on each clock; the next move still uses the real
 * command.
 */
export const givenMultiplayerPosition = scenarioAction({
  name: 'givenMultiplayerPosition',
  act: (
    s,
    actor: string,
    position: {
      readonly gameId: string;
      readonly fen: string;
      readonly clockMs?: number;
    }
  ) =>
    multiplayerFixture(s, actor, async (tx, env) => {
      const { gameId, fen, clockMs } = position;
      const nowMs = env.now().getTime();
      await tx.run(sql`UPDATE chess_multiplayer_games SET fen = ${fen}, pgn = ${''},
        turn = ${env.actorId}, revision = ${2}, clock_at_ms = ${nowMs},
        white_ms = COALESCE(${clockMs ?? null}, white_ms), black_ms = COALESCE(${clockMs ?? null}, black_ms),
        updated_at = ${env.now().toISOString()} WHERE id = ${gameId}`);
      return publishMultiplayerFixture(tx, gameId, env);
    }),
});

/** Time left on one side's clock, that side to move, its clock running from now. */
export const givenMultiplayerClock = scenarioAction({
  name: 'givenMultiplayerClock',
  act: (
    s,
    actor: string,
    clock: {
      readonly gameId: string;
      readonly side: 'white' | 'black';
      readonly ms: number;
    }
  ) =>
    multiplayerFixture(s, actor, async (tx, env) => {
      const { gameId, side, ms } = clock;
      const nowMs = env.now().getTime();
      await tx.run(
        side === 'white'
          ? sql`UPDATE chess_multiplayer_games SET white_ms = ${ms}, clock_at_ms = ${nowMs} WHERE id = ${gameId}`
          : sql`UPDATE chess_multiplayer_games SET black_ms = ${ms}, clock_at_ms = ${nowMs} WHERE id = ${gameId}`
      );
      return publishMultiplayerFixture(tx, gameId, env);
    }),
});

/** A multiplayer rating at one speed, with this many rated games behind it. */
export const givenMultiplayerRating = scenarioAction({
  name: 'givenMultiplayerRating',
  act: (
    s,
    actor: string,
    speed: MultiplayerSpeed,
    rating: { readonly rating: number; readonly games: number }
  ) =>
    multiplayerFixture(s, actor, async (tx, env) => {
      await new MultiplayerRatingRepository(tx).write(
        env.actorId,
        speed,
        {
          rating: rating.rating,
          ratingDeviation: rating.games > 0 ? 80 : 350,
          volatilityMicros: 60_000,
          games: rating.games,
        },
        env.now().getTime()
      );
      return [env.actorId];
    }),
});
