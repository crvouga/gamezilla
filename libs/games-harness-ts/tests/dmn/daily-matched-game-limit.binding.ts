/**
 * `specs/games/daily-matched-game-limit.dmn` against the permission system.
 * The daily matched game limit is one allowance for every game offering
 * matched games, so its decision is the platform's and it is enforced when
 * a person seeks an opponent in each game:
 *
 * - application decision — the kernel's quota decision for the case's
 *   person (facts from the product's resolver), counting the case's started
 *   matched games through the product's own window arithmetic;
 * - server enforcement in each game — seeking an opponent in that game,
 *   replayed with the authorize hook against a server database holding the
 *   person's matched games of another game, over, started on the UTC day
 *   boundary (today's at midnight, earlier ones a millisecond before): an
 *   allowed case begins the search, a refused one stores nothing and says
 *   why.
 *
 * The device does not gate it: only the server holds every matched game the
 * person started, so the refusal is the server's, shown with its invitation.
 */

import { findOpponentMutation } from '@libs/game-matchmaking-shared-ts/find-opponent-mutation';
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { opponentSearchGuard } from '@libs/game-session-server-ts/opponent-search-guard';
import { dailyMatchedGameLimitApplicationLayer } from '@libs/permissions-harness-ts/application';
import { startedMatchedGameTimes } from '@libs/permissions-harness-ts/started-matched-games';
import { authorizeAppMutation } from '@libs/permissions-shared-ts/authorize-app-mutation';
import { DAILY_MATCHED_GAME_LIMIT_REASONS } from '@libs/permissions-shared-ts/reasons';
import {
  replayOperation,
  type ServerCase,
  serverEnforcementLayer,
} from '@libs/permissions-shared-ts/server';
import type { DecisionLayer } from '@pkgs/dmn-shared-ts/registry';
import { bindDecisions } from '@pkgs/dmn-shared-ts/registry';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { gamesHeldTo } from '../conformance-world';
import { limitProbeChoice } from './limit-probe-choice';
import {
  LIMIT_SPACE,
  limitRooms,
  MULTIPLAYER_LIMIT_TABLES,
  seedUnfinishedGames,
} from './unfinished-game-limit-world';

/** Every game offering matched games: each one's count toward the same 5. */
const GAMES = gamesHeldTo('specs/games/daily-matched-game-limit.dmn');

/** The game whose matched games were started before `game`'s: the next one round. */
function otherGame(game: HarnessGame): HarnessGame {
  const other = GAMES[(GAMES.indexOf(game) + 1) % GAMES.length];
  if (other === undefined || other === game)
    throw new Error('The daily matched game limit needs two games');
  return other;
}

const NO_UNFINISHED = {
  'unfinished matched games': 0,
  'custom games under way as a participant': 0,
};

/** The case's started matched games, of `game`, each over by agreement. */
function seedStartedGames(game: HarnessGame) {
  const space = seedUnfinishedGames(game);
  return async (c: ServerCase) => {
    // The person's space and the matchmaking tables, with no unfinished game.
    await space({ ...c, input: { ...c.input, ...NO_UNFINISHED } });
    for (const [n, at] of startedMatchedGameTimes(c.input, c.nowMs).entries())
      await c.db.run(sql`INSERT INTO chess_multiplayer_games
        (id, match_id, white_id, black_id, fen, pgn, revision, turn, outcome, reason, created_at, updated_at, deleted_at)
        VALUES (${`started-${n}`}, ${`started-match-${n}`}, ${c.env.actorId}, ${`opponent-${n}`},
          ${game.shared.registration.rules.initial()}, ${''}, ${0}, ${''},
          ${'draw'}, ${'agreement'}, ${at}, ${at}, ${null})`);
  };
}

/** Seeking an opponent in `game` after the case's matched games of another. */
function serverEnforcementIn(game: HarnessGame): DecisionLayer {
  const searchGuard = opponentSearchGuard(limitRooms(game));
  const matchmaking = game.shared.registration.capabilities.matchmaking;
  if (matchmaking === undefined)
    throw new Error(`${game.label} offers no finding an opponent`);
  return serverEnforcementLayer({
    tables: MULTIPLAYER_LIMIT_TABLES,
    reasons: DAILY_MATCHED_GAME_LIMIT_REASONS,
    seed: seedStartedGames(otherGame(game)),
    guard: async (ctx) => {
      await authorizeAppMutation(ctx);
      await searchGuard(ctx);
    },
    operationFor: () => async (c) => {
      const replay = replayOperation(findOpponentMutation, () => ({
        requestId: 'next-matched-game',
        spaceId: LIMIT_SPACE,
        timeControl: limitProbeChoice(matchmaking),
      }));
      await replay({
        ...c,
        env: {
          ...c.env,
          turnGames: createTurnGames(GAMES.map((g) => g.shared.registration)),
        },
      });
    },
  });
}

bindDecisions({
  spec: 'daily-matched-game-limit',
  layers: {
    'application decision': dailyMatchedGameLimitApplicationLayer(),
    ...Object.fromEntries(
      GAMES.map((game) => [
        `server enforcement in ${game.label}`,
        serverEnforcementIn(game),
      ])
    ),
  },
});
