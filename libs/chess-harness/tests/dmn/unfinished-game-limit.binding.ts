import { findChessOpponentMutation } from '@libs/chess-matchmaking-shared/find-opponent-mutation';
import { LIMIT } from '@libs/permissions-shared/permission-catalog';
import { useLimitDecision } from '@libs/permissions-client/use-can';
import { DEFAULT_PERMISSION_POLICY } from '@libs/permissions-shared/permission-policy';
import { clientGatingLayer } from '@libs/permissions-harness/client';
import {
  CASE_NOW_MS,
  countInput,
  factsOf,
} from '@libs/permissions-shared/people';
import { tableAnswer } from '@libs/permissions-shared/reasons';
import {
  replayOperation,
  serverEnforcementLayer,
} from '@libs/permissions-shared/server';
import { bindDecisions } from '@pkgs/dmn-shared/registry';
import { decideLimit } from '@pkgs/permissions-shared/decision';
import { policyAt } from '@pkgs/permissions-shared/policy';
import { resolveSubject } from '@pkgs/permissions-shared/resolve';
import sql from '@pkgs/sql-shared/sql';
import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import {
  MULTIPLAYER_LIMIT_TABLES,
  seedUnfinishedGames,
  UNFINISHED_INPUT,
} from './multiplayer-limit-world';

const REASONS = {
  limit_reached: 'finish the current multiplayer game',
} as const;

bindDecisions({
  spec: 'unfinished-game-limit',
  layers: {
    'application decision': {
      observes: ['answer', 'reason'],
      decide(input) {
        const policy = policyAt(DEFAULT_PERMISSION_POLICY, CASE_NOW_MS);
        return tableAnswer(
          decideLimit(
            policy,
            resolveSubject(policy, factsOf(input, CASE_NOW_MS), []),
            LIMIT.unfinishedMultiplayerGames,
            countInput(input, UNFINISHED_INPUT)
          ),
          REASONS
        );
      },
    },
    'server enforcement': serverEnforcementLayer({
      tables: MULTIPLAYER_LIMIT_TABLES,
      reasons: REASONS,
      seed: seedUnfinishedGames,
      operationFor: () =>
        replayOperation(findChessOpponentMutation, () => ({
          requestId: 'another-game',
        })),
    }),
    'client gating': clientGatingLayer({
      tables: MULTIPLAYER_LIMIT_TABLES,
      observes: ['answer', 'reason'],
      seed: seedUnfinishedGames,
      probe: () => {
        const games = createQuery(
          () =>
            sql<{
              id: string;
            }>`SELECT id FROM chess_multiplayer_games WHERE outcome = ${'ongoing'} AND deleted_at IS NULL`
        );
        const decision = useLimitDecision(
          LIMIT.unfinishedMultiplayerGames,
          () => games.rows().length
        );
        return () => tableAnswer(decision(), REASONS);
      },
    }),
  },
});
