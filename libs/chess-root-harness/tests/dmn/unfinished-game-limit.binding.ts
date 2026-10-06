import { findChessOpponentMutation } from '@libs/chess-matchmaking-shared/find-opponent-mutation';
import { opponentSearchGuard } from '@libs/chess-root-server/opponent-search-guard';
import { useUnfinishedGamesDecision } from '@libs/permissions-client/use-can';
import { clientGatingLayer } from '@libs/permissions-harness/client';
import { authorizeAppMutation } from '@libs/permissions-shared/authorize-app-mutation';
import {
  CASE_NOW_MS,
  countInput,
  factsOf,
} from '@libs/permissions-shared/people';
import { LIMIT } from '@libs/permissions-shared/permission-catalog';
import { DEFAULT_PERMISSION_POLICY } from '@libs/permissions-shared/permission-policy';
import { tableAnswer } from '@libs/permissions-shared/reasons';
import {
  replayOperation,
  serverEnforcementLayer,
} from '@libs/permissions-shared/server';
import { decideUnfinishedGames } from '@libs/permissions-shared/unfinished-games-permission';
import { bindDecisions } from '@pkgs/dmn-shared/registry';
import { decideLimit } from '@pkgs/permissions-shared/decision';
import { policyAt } from '@pkgs/permissions-shared/policy';
import { resolveSubject } from '@pkgs/permissions-shared/resolve';
import sql from '@pkgs/sql-root-shared/sql';
import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import {
  CUSTOM_GAME_INPUT,
  LIMIT_ROOMS,
  MULTIPLAYER_LIMIT_TABLES,
  seedUnfinishedGames,
  UNFINISHED_INPUT,
} from './multiplayer-limit-world';

const REASONS = {
  limit_reached: 'finish the current multiplayer game',
  restricted: 'finish the current Custom Game',
} as const;

const searchGuard = opponentSearchGuard(LIMIT_ROOMS);

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
    'server enforcement': serverEnforcementLayer({
      tables: MULTIPLAYER_LIMIT_TABLES,
      reasons: REASONS,
      seed: seedUnfinishedGames,
      // The server reads the space rooms before the body, as the API does.
      guard: async (ctx) => {
        await authorizeAppMutation(ctx);
        await searchGuard(ctx);
      },
      operationFor: () =>
        replayOperation(findChessOpponentMutation, () => ({
          requestId: 'another-game',
          spaceId: 'multiplayer-limit-space',
        })),
    }),
    'client gating': clientGatingLayer({
      tables: MULTIPLAYER_LIMIT_TABLES,
      observes: ['answer', 'reason'],
      seed: seedUnfinishedGames,
      // The device reads its space's Custom Game from the room, outside this
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
