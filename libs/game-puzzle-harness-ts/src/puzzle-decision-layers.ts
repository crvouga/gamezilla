import { useDecision } from '@libs/permissions-client-ts/use-can';
import { clientGatingLayer } from '@libs/permissions-harness-ts/client';
import { grantKeyOf } from '@libs/permissions-shared-ts/capabilities';
import {
  CASE_NOW_MS,
  capabilityOf,
  factsOf,
  identityFor,
  personOf,
} from '@libs/permissions-shared-ts/people';
import { DEFAULT_PERMISSION_POLICY } from '@libs/permissions-shared-ts/permission-policy';
import { tableAnswer } from '@libs/permissions-shared-ts/reasons';
import { resolveResourceRoles } from '@libs/permissions-shared-ts/resource-roles';
import { serverEnforcementLayer } from '@libs/permissions-shared-ts/server';
import type { DecisionLayer } from '@pkgs/dmn-shared-ts/registry';
import { decide } from '@pkgs/permissions-shared-ts/decision';
import { policyAt } from '@pkgs/permissions-shared-ts/policy';
import { resolveSubject } from '@pkgs/permissions-shared-ts/resolve';
import { puzzleDecisionOperation } from './puzzle-decision-operations';
import {
  PUZZLE_DECISION_TABLES,
  puzzleDecisionScope,
  seedPuzzleDecision,
} from './puzzle-decision-world';

const REASONS = { not_granted: 'belongs to someone else' } as const;

/** All cases use the existing counting reference application and actual policy/client/replay paths. */
export function puzzleContentDecisionLayers(): Readonly<
  Record<string, DecisionLayer>
> {
  return {
    'application decision': {
      observes: ['answer', 'reason'],
      decide(input) {
        const policy = policyAt(DEFAULT_PERMISSION_POLICY, CASE_NOW_MS);
        const actorId = identityFor(personOf(input)).actorId;
        const subject = resolveSubject(
          policy,
          factsOf(input, CASE_NOW_MS),
          resolveResourceRoles(actorId, puzzleDecisionScope(input))
        );
        return tableAnswer(
          decide(policy, subject, grantKeyOf(capabilityOf(input))),
          REASONS
        );
      },
    },
    'server enforcement': serverEnforcementLayer({
      tables: PUZZLE_DECISION_TABLES,
      seed: seedPuzzleDecision,
      operationFor: puzzleDecisionOperation,
      reasons: REASONS,
    }),
    'client gating': clientGatingLayer({
      tables: PUZZLE_DECISION_TABLES,
      observes: ['answer', 'reason'],
      probe(input) {
        const decision = useDecision(grantKeyOf(capabilityOf(input)), () =>
          puzzleDecisionScope(input)
        );
        return () => tableAnswer(decision(), REASONS);
      },
    }),
  };
}
