import { can } from '@pkgs/permissions';
import { type Accessor, createMemo } from 'solid-js';

import type { AppPermission } from './permission-catalog';
import { usePermissionPolicy } from './use-permission-policy';
import { usePermissionSubject } from './use-permission-subject';

/** Whether the caller holds `permission` right now. */
export function useCan(permission: AppPermission): Accessor<boolean> {
  const policy = usePermissionPolicy();
  const subject = usePermissionSubject();
  return createMemo(() => can(policy(), subject(), permission).allowed);
}
