/**
 * The application decision, per decision table: the permission kernel
 * (`decide`, `decideLimit`, `decideQuota`) on the shipped policy — or a
 * changed copy, for mutation tests — for a subject resolved from the facts
 * the product's own resolver makes of the case's person. The quota layer
 * counts the case's started puzzles through the product's own window and
 * ledger arithmetic, exactly as the client's `usePermissions().can` does.
 *
 * For tests and spec bindings only (a `root/` export).
 */

import type { DecisionLayer } from '@pkgs/dmn/registry';
import {
  decide,
  decideLimit,
  decideQuota,
  type PolicyVersion,
  policyAt,
  quotaWindowOf,
  resolveSubject,
  type Subject,
} from '@pkgs/permissions';

import { unitsSince } from '../../shared/ledger-time';
import {
  ACTION,
  type AppLimit,
  type AppPolicyKey,
  LIMIT,
} from '../../shared/permission-catalog';
import { DEFAULT_PERMISSION_POLICY } from '../../shared/permission-policy';
import { resolveSpaceRoles } from '../../shared/space-roles';
import { grantKeyOf } from './capabilities';
import {
  CASE_NOW_MS,
  type CaseInput,
  capabilityOf,
  countInput,
  DMN_INPUT,
  factsOf,
  spacePresenceOf,
} from './people';
import { startedEntries } from './puzzle-ledger';
import {
  ACCESS_REASONS,
  answerOnly,
  DAILY_PUZZLE_LIMIT_REASONS,
  HOSTING_LIMIT_REASONS,
  tableAnswer,
} from './reasons';
import type { AppPolicy } from './world';

type Active = PolicyVersion<AppPolicyKey, AppLimit>;

function activePolicy(policy: AppPolicy): Active {
  return policyAt(policy, CASE_NOW_MS);
}

function subjectOf(
  active: Active,
  input: CaseInput,
  extraRoles: readonly string[] = []
): Subject {
  return resolveSubject(active, factsOf(input, CASE_NOW_MS), extraRoles);
}

/** `access`: may this person do this? Answer and reason. */
export function accessApplicationLayer(
  policy: AppPolicy = DEFAULT_PERMISSION_POLICY
): DecisionLayer {
  return {
    observes: ['answer', 'reason'],
    decide: (input) => {
      const active = activePolicy(policy);
      const key = grantKeyOf(capabilityOf(input));
      return tableAnswer(
        decide(active, subjectOf(active, input), key),
        ACCESS_REASONS
      );
    },
  };
}

/**
 * `space-roles`: the answer only — the product refuses both "only the host"
 * and "not in the space" as `not_granted`.
 */
export function spaceRolesApplicationLayer(
  policy: AppPolicy = DEFAULT_PERMISSION_POLICY
): DecisionLayer {
  return {
    observes: ['answer'],
    decide: (input) => {
      const active = activePolicy(policy);
      const roles = resolveSpaceRoles(spacePresenceOf(input));
      const key = grantKeyOf(capabilityOf(input));
      return answerOnly(decide(active, subjectOf(active, input, roles), key));
    },
  };
}

/** `hosting-limit`: one more open space, holding the case's number. */
export function hostingLimitApplicationLayer(
  policy: AppPolicy = DEFAULT_PERMISSION_POLICY
): DecisionLayer {
  return {
    observes: ['answer', 'reason'],
    decide: (input) => {
      const active = activePolicy(policy);
      const held = countInput(input, DMN_INPUT.open);
      return tableAnswer(
        decideLimit(active, subjectOf(active, input), LIMIT.hostedSpaces, held),
        HOSTING_LIMIT_REASONS
      );
    },
  };
}

/** `daily-puzzle-limit`: one more rated puzzle, counted in today's window. */
export function dailyPuzzleLimitApplicationLayer(
  policy: AppPolicy = DEFAULT_PERMISSION_POLICY
): DecisionLayer {
  return {
    observes: ['answer', 'reason'],
    decide: (input) => {
      const active = activePolicy(policy);
      const subject = subjectOf(active, input);
      const quota = ACTION.puzzleRatedSolve;
      const window = quotaWindowOf(active, subject, quota, {
        nowMs: CASE_NOW_MS,
      });
      const used =
        window === undefined
          ? 0
          : unitsSince(startedEntries(input, CASE_NOW_MS), window.startMs);
      return tableAnswer(
        decideQuota(active, subject, quota, { used, nowMs: CASE_NOW_MS }),
        DAILY_PUZZLE_LIMIT_REASONS
      );
    },
  };
}
