import type { PermissionPolicy } from '@pkgs/permissions-shared-ts/policy';
import { definePolicy } from '@pkgs/permissions-shared-ts/policy';
import type { AppLimit, AppPolicyKey } from './permission-catalog';
import { PERMISSION, ROLE } from './permission-catalog';

/**
 * What an operator may do: use the User Observatory (see who is online now
 * and watch them live) and its Synthetic Population panel.
 */
export const OPERATOR_PERMISSIONS = [
  PERMISSION.observatoryView,
  PERMISSION.observatoryWatch,
  PERMISSION.syntheticPopulationView,
  PERMISSION.syntheticPopulationInspect,
  PERMISSION.syntheticPopulationConfigure,
  PERMISSION.syntheticPopulationControl,
  PERMISSION.syntheticPopulationReplay,
] as const;

/** Explicit environment account allow-list; no ordinary account inherits administration. */
export function withOperators(
  policy: PermissionPolicy<AppPolicyKey, AppLimit>,
  accountIds: readonly string[]
): PermissionPolicy<AppPolicyKey, AppLimit> {
  return definePolicy<AppPolicyKey, AppLimit>({
    ...policy,
    roles: {
      ...policy.roles,
      [ROLE.syntheticPopulationOperator]: {
        when: { accountId: [...new Set(accountIds)].sort() },
        permissions: [...OPERATOR_PERMISSIONS],
      },
    },
  });
}
