import type { AppRole, SpacePresenceRole } from './permission-catalog';
import { ROLE } from './permission-catalog';

/** Presence role → the roles a subject holds inside that space. */
export function resolveSpaceRoles(
  role: SpacePresenceRole | null
): readonly AppRole[] {
  if (role === 'host') return [ROLE.spaceHost];
  if (role === 'guest') return [ROLE.spaceMember];
  return [];
}
