import type { AppPermission } from '@libs/permissions/public/permission-catalog';
import { useDecision } from '@libs/permissions/public/use-can';
import { useSpacePresence } from './use-space-presence';

/** The permission decision scoped to this install's presence in a space. */
export function useSpaceDecision(
  spaceId: () => string,
  permission: AppPermission
) {
  const presence = useSpacePresence(spaceId);
  return useDecision(permission, () => {
    const current = presence();
    return { spacePresence: current.status === 'active' ? current.role : null };
  });
}
