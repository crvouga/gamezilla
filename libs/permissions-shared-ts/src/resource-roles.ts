import type { AccessScope } from './access-scope';
import { type AppRole, ROLE } from './permission-catalog';
import { resolveSpaceRoles } from './space-roles';

/** Client affordances and authoritative decisions resolve the same scoped facts. */
export function resolveResourceRoles(
  actorId: string,
  scope?: AccessScope
): readonly AppRole[] {
  return [
    ...resolveSpaceRoles(scope?.spacePresence ?? null),
    ...(actorId.length > 0 && scope?.puzzleOwnerId === actorId
      ? [ROLE.puzzleAuthor]
      : []),
    ...(actorId.length > 0 && scope?.puzzlePlayerId === actorId
      ? [ROLE.puzzlePlayer]
      : []),
  ];
}
