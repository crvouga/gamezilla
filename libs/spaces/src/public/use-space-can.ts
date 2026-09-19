import type { AppPermission } from '@libs/permissions/public/permission-catalog';
import { resolveSpaceRoles } from '@libs/permissions/public/space-roles';
import { usePermissionPolicy } from '@libs/permissions/public/use-permission-policy';
import { usePermissionSubject } from '@libs/permissions/public/use-permission-subject';
import { can, withRoles } from '@pkgs/permissions';
import { type Accessor, createMemo } from 'solid-js';

import { useSpacePresence } from './use-space-presence';

/**
 * Whether the caller holds `permission` in `spaceId`: the app-wide subject plus
 * the caller's presence role in that space.
 */
export function useSpaceCan(
  spaceId: string | Accessor<string>,
  permission: AppPermission
): Accessor<boolean> {
  const policy = usePermissionPolicy();
  const subject = usePermissionSubject();
  const presence = useSpacePresence(spaceId);
  return createMemo(() => {
    const current = presence();
    const role = current.status === 'active' ? current.role : null;
    return can(
      policy(),
      withRoles(subject(), resolveSpaceRoles(role)),
      permission
    ).allowed;
  });
}
