import type { PermissionPolicy } from '@pkgs/permissions-shared/policy';
import { definePolicy } from '@pkgs/permissions-shared/policy';
import type { AppLimit, AppPolicyKey } from './permission-catalog';
import { PERMISSION, ROLE } from './permission-catalog';

/** Explicit environment account allow-list; no ordinary account inherits administration. */
export function withSyntheticPopulationOperators(
  policy: PermissionPolicy<AppPolicyKey, AppLimit>,
  accountIds: readonly string[]
): PermissionPolicy<AppPolicyKey, AppLimit> {
  return definePolicy<AppPolicyKey, AppLimit>({
    ...policy,
    roles: {
      ...policy.roles,
      [ROLE.syntheticPopulationOperator]: {
        when: { accountId: [...new Set(accountIds)].sort() },
        permissions: [
          PERMISSION.syntheticPopulationView,
          PERMISSION.syntheticPopulationInspect,
          PERMISSION.syntheticPopulationConfigure,
          PERMISSION.syntheticPopulationControl,
          PERMISSION.syntheticPopulationReplay,
        ],
      },
    },
  });
}
