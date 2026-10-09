import type { PermissionPolicy } from '@pkgs/permissions-shared/policy';
import { definePolicy } from '@pkgs/permissions-shared/policy';
import type { AppLimit, AppPolicyKey } from './permission-catalog';
import { PERMISSION, ROLE } from './permission-catalog';

/** Explicit environment account allow-list; no ordinary account inherits administration. */
export function withPopulationOperators(
  policy: PermissionPolicy<AppPolicyKey, AppLimit>,
  accountIds: readonly string[]
): PermissionPolicy<AppPolicyKey, AppLimit> {
  return definePolicy<AppPolicyKey, AppLimit>({
    ...policy,
    roles: {
      ...policy.roles,
      [ROLE.populationOperator]: {
        when: { accountId: [...new Set(accountIds)].sort() },
        permissions: [
          PERMISSION.populationView,
          PERMISSION.populationInspect,
          PERMISSION.populationConfigure,
          PERMISSION.populationControl,
          PERMISSION.populationReplay,
        ],
      },
    },
  });
}
