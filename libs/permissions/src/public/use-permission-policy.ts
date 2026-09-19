import { ClientConfigKey } from '@libs/client-config/public/client-config-keys';
import { useClientConfig } from '@libs/client-config/public/use-client-config';
import type { PermissionPolicy } from '@pkgs/permissions';
import { type Accessor, createMemo } from 'solid-js';
import { parsePermissionPolicy } from './parse-permission-policy';
import type { AppLimit, AppPolicyKey } from './permission-catalog';

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
