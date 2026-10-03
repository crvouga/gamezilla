import { findChessOpponentMutation } from '@libs/chess/root/mutations';
import { LIMIT } from '@libs/permissions/public/permission-catalog';
import { useLimitDecision } from '@libs/permissions/public/use-can';
import { DEFAULT_PERMISSION_POLICY } from '@libs/permissions/root/access-model';
import { clientGatingLayer } from '@libs/permissions/root/conformance/client';
import {
  CASE_NOW_MS,
  countInput,
  factsOf,
} from '@libs/permissions/root/conformance/people';
import { tableAnswer } from '@libs/permissions/root/conformance/reasons';
import {
  replayOperation,
  serverEnforcementLayer,
} from '@libs/permissions/root/conformance/server';
import { bindDecisions } from '@pkgs/dmn/registry';
import { decideLimit, policyAt, resolveSubject } from '@pkgs/permissions';
import { sql } from '@pkgs/sql';
import { createQuery } from '@pkgs/sync-engine/solid';
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
