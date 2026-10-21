import { findOpponentMutation } from '@libs/game-matchmaking-shared/find-opponent-mutation';
import { MultiplayerGameRepository } from '@libs/game-matchmaking-shared/game-repository';
import { formGameMatches } from '@libs/game-matchmaking-shared/match-handoff';
import { scheduleMultiplayerDeadline } from '@libs/game-matchmaking-shared/multiplayer-deadline';
import { publishMatchGame } from '@libs/game-matchmaking-shared/publish-match-game';
import { MultiplayerRatingRepository } from '@libs/game-matchmaking-shared/rating-repository';
import { OPPONENT_SEARCH_RADIUS } from '@libs/game-matchmaking-shared/search-config';
import type { MultiplayerSpeed } from '@libs/game-matchmaking-shared/time-control';
import { scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { signedInAccountOf } from '@libs/harness/identity';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import type { MutationEnv } from '@pkgs/sync-engine-shared/mutations-types';
import { multiplayerFixture } from './multiplayer-fixtures-core';
import { chooseKnownSetups } from './multiplayer-setups';
import { multiplayerSpaceId } from './multiplayer-spaces';

/** Fixture writes are actual mutation bodies, with normal captured sync pushes. */
export const givenOpponentSearch = scenarioAction<
  [actor: string, timeControl: string, requestId?: string]
>({
  name: 'givenOpponentSearch',
  act: async (
    s,
    actor: string,
    timeControl: string,
    requestId = s.session.ports.createId()
  ) => {
    const spaceId = await multiplayerSpaceId(s, actor);
    return multiplayerFixture(s, actor, async (tx, env) => {
      await findOpponentMutation.run(
        { tx, env },
        { requestId, timeControl, spaceId: spaceId ?? 'no-space' }
      );
      return [env.actorId];
    });
  },
});

/**
 * The formation pass. `firstIsWhite` fixes the chance that settles equal
 * colour balances, for a setup that names the colours.
 */
export const pairGameOpponents = scenarioAction<
  [actor?: string, firstIsWhite?: boolean]
>({
  name: 'pairGameOpponents',
  act: async (s, actor = 'alice', firstIsWhite?: boolean) => {
    // The pass may run again after its first attempt: keep everyone it formed.
    const formed = new Set<string>();
    await multiplayerFixture(s, actor, async (tx) => {
      const pass = await formGameMatches(
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
      for (const owner of pass) formed.add(owner);
      return pass;
    });
    // Whoever was paired is in a new matched game, its private setups chosen.
    await Promise.resolve(chooseKnownSetups.act(s, [...s.actors.keys()]));
  },
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
    await formMatchOf(s, [first, second], firstIsWhite);
    // A new matched game is ready to play: private setups are chosen.
    await Promise.resolve(chooseKnownSetups.act(s, [first, second]));
  },
});

/** The match forms as for {@link awaitGameMatch}, its private setups still to choose. */
export const awaitGameMatchChoosingSetups = scenarioAction<
  [first: string, second: string, firstIsWhite?: boolean]
>({
  name: 'awaitGameMatchChoosingSetups',
  act: async (s, first: string, second: string, firstIsWhite?: boolean) =>
    formMatchOf(s, [first, second], firstIsWhite),
});

async function formMatchOf(
  s: ProductHarness,
  pair: readonly [string, string],
  firstIsWhite?: boolean
): Promise<void> {
  const [first, second] = pair;
  {
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
  }
}

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
