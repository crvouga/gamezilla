import { useClientConfig } from '@libs/app-config-client-ts/use-client-config';
import { ClientConfigKey } from '@libs/app-config-shared-ts/client-config-keys';
import { parsePermissionPolicy } from '@libs/permissions-shared-ts/parse-permission-policy';
import type {
  AppLimit,
  AppPolicyKey,
} from '@libs/permissions-shared-ts/permission-catalog';
import type { PermissionPolicy } from '@pkgs/permissions-shared-ts/policy';
import { type Accessor, createMemo } from 'solid-js';

/** Live `permission_policy` from synced `client_config`; default when absent. */
export function usePermissionPolicy(): Accessor<
  PermissionPolicy<AppPolicyKey, AppLimit>
> {
  const { rows } = useClientConfig();
  return createMemo(() => {
    const row = rows().find(
      (candidate) =>
        candidate.id === ClientConfigKey.permissionPolicy &&
        candidate.deleted_at === null
    );
    return parsePermissionPolicy(row === undefined ? null : row.value);
  });
}
