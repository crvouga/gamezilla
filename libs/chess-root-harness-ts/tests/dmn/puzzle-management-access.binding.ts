import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { permissionPolicyForPuzzleManagers } from '@libs/permissions-shared-ts/permission-policy';
import type {
  DecisionInput,
  DecisionOutput,
} from '@pkgs/dmn-shared-ts/evaluate';
import {
  bindDecisions,
  type DecisionLayer,
} from '@pkgs/dmn-shared-ts/registry';
import { decide } from '@pkgs/permissions-shared-ts/decision';
import { resolveSubject } from '@pkgs/permissions-shared-ts/resolve';

const MANAGER_ID = 'puzzle-manager';

function answer(input: DecisionInput): DecisionOutput {
  const signedIn = input['signed in'] === 'yes';
  const onTeam = input['on the team for this environment'] === 'yes';
  const policy = permissionPolicyForPuzzleManagers(onTeam ? [MANAGER_ID] : []);
  const decision = decide(
    policy,
    resolveSubject(policy, {
      auth: signedIn ? 'verified' : 'anonymous',
      accountId: signedIn ? MANAGER_ID : null,
      membership: 'none',
      subscription: 'none',
      billing: 'off',
    }),
    PERMISSION.puzzlesManage
  );
  if (decision.allowed) return { answer: 'yes', reason: 'none' };
  return {
    answer: 'no',
    reason:
      decision.reason === 'requires_account'
        ? 'needs an account'
        : 'not on the team',
  };
}

function layer(): DecisionLayer {
  return { observes: ['answer', 'reason'], decide: answer };
}

bindDecisions({
  spec: 'puzzle-management-access',
  layers: {
    'application decision': layer(),
    'server enforcement': layer(),
    'client gating': layer(),
  },
});
