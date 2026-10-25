import { findOpponentMutation } from '@libs/game-matchmaking-shared-ts/find-opponent-mutation';
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { opponentSearchGuard } from '@libs/game-session-server-ts/opponent-search-guard';
import { useUnfinishedGamesDecision } from '@libs/permissions-client-ts/use-can';
import { clientGatingLayer } from '@libs/permissions-harness-ts/client';
import { authorizeAppMutation } from '@libs/permissions-shared-ts/authorize-app-mutation';
import {
  CASE_NOW_MS,
  countInput,
  factsOf,
} from '@libs/permissions-shared-ts/people';
import { LIMIT } from '@libs/permissions-shared-ts/permission-catalog';
import { DEFAULT_PERMISSION_POLICY } from '@libs/permissions-shared-ts/permission-policy';
import { tableAnswer } from '@libs/permissions-shared-ts/reasons';
import {
  replayOperation,
  serverEnforcementLayer,
} from '@libs/permissions-shared-ts/server';
import { decideUnfinishedGames } from '@libs/permissions-shared-ts/unfinished-games-permission';
import type { DecisionLayer } from '@pkgs/dmn-shared-ts/registry';
import { bindDecisions } from '@pkgs/dmn-shared-ts/registry';
import { decideLimit } from '@pkgs/permissions-shared-ts/decision';
import { policyAt } from '@pkgs/permissions-shared-ts/policy';
import { resolveSubject } from '@pkgs/permissions-shared-ts/resolve';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { gamesHeldTo } from '../conformance-world';
import {
  CUSTOM_GAME_INPUT,
  LIMIT_SPACE,
  limitRooms,
  MULTIPLAYER_LIMIT_TABLES,
  seedUnfinishedGames,
  UNFINISHED_INPUT,
} from './unfinished-game-limit-world';

/** Every game the table holds for. */
const GAMES = gamesHeldTo('specs/games/unfinished-game-limit.dmn');

const REASONS = {
  limit_reached: 'finish the current matched game',
  restricted: 'finish the current custom game',
} as const;

/**
 * The server's refusal of seeking an opponent in `game`, with the earlier
 * matched games and the custom game under way of that game: each game is
 * its own layer, so every case runs through every game.
 */
function serverEnforcementIn(game: HarnessGame): DecisionLayer {
  const searchGuard = opponentSearchGuard(limitRooms(game));
  const matchmaking = game.shared.registration.capabilities.matchmaking;
  if (matchmaking === undefined)
    throw new Error(`${game.label} offers no finding an opponent`);
  return serverEnforcementLayer({
    tables: MULTIPLAYER_LIMIT_TABLES,
    reasons: REASONS,
    seed: seedUnfinishedGames(game),
    // The server reads the space rooms before the body, as the API does.
    guard: async (ctx) => {
      await authorizeAppMutation(ctx);
      await searchGuard(ctx);
    },
    operationFor: () => async (c) => {
      const replay = replayOperation(findOpponentMutation, () => ({
        requestId: 'another-game',
        spaceId: LIMIT_SPACE,
        timeControl: `${matchmaking.namespace}5+0`,
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
  spec: 'unfinished-game-limit',
  layers: {
    'application decision': {
      observes: ['answer', 'reason'],
      decide(input) {
        const policy = policyAt(DEFAULT_PERMISSION_POLICY, CASE_NOW_MS);
        return tableAnswer(
          decideUnfinishedGames(
            decideLimit(
              policy,
              resolveSubject(policy, factsOf(input, CASE_NOW_MS), []),
              LIMIT.unfinishedMultiplayerGames,
              countInput(input, UNFINISHED_INPUT)
            ),
            countInput(input, CUSTOM_GAME_INPUT)
          ),
          REASONS
        );
      },
    },
    ...Object.fromEntries(
      GAMES.map((game) => [
        `server enforcement in ${game.label}`,
        serverEnforcementIn(game),
      ])
    ),
    'client gating': clientGatingLayer({
      tables: MULTIPLAYER_LIMIT_TABLES,
      observes: ['answer', 'reason'],
      seed: seedUnfinishedGames(GAMES[0]!),
      // The device reads its space's custom game from the room, outside this
      // fixture's rows: the case's count stands for it.
      probe: (input) => {
        const games = createQuery(
          () =>
            sql<{
              id: string;
            }>`SELECT id FROM chess_multiplayer_games WHERE outcome = ${'ongoing'} AND deleted_at IS NULL`
        );
        const decision = useUnfinishedGamesDecision(() => ({
          multiplayer: games.rows().length,
          customGames: countInput(input, CUSTOM_GAME_INPUT),
        }));
        return () => tableAnswer(decision(), REASONS);
      },
    }),
  },
});
