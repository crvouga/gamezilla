import type { AppPermission } from '@libs/permissions/public/permission-catalog';
import { useCan } from '@libs/permissions/public/use-can';
import type { Accessor } from 'solid-js';

import { useSpacePresence } from './use-space-presence';

/**
 * Whether the caller may `permission` in `spaceId`: the permission system's
 * decision with the caller's presence in that space as scope.
 */
export function useSpaceCan(
  spaceId: string | Accessor<string>,
  permission: AppPermission
): Accessor<boolean> {
  const presence = useSpacePresence(spaceId);
  return useCan(permission, () => {
    const current = presence();
    return {
      spacePresence: current.status === 'active' ? current.role : null,
    };
  });
}
