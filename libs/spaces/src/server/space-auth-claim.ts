/**
 * Space-scoped auth claims layered onto the sync caller context. Only the
 * spaces bounded context owns this namespace — auth has no business knowing
 * which spaces a caller is a member of.
 *
 * Stamped lazily by {@link createMemberOfSpaceIdsEnricher} (registered as a
 * sync `enrichContext` hook) so the lookup runs **at most once per read /
 * write batch**, only when ABAC is actually about to inspect the context.
 */
import { type AttributeState, createAttrNamespace } from '@pkgs/attribute';

const spacesNs = createAttrNamespace('spaces');

function readStringArray(v: unknown): readonly string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

export const SpaceAuthClaimAttr = {
  memberOfSpaceIds: spacesNs.array('member-of-space-ids', readStringArray),
} as const;

/** Reads `spaces/member-of-space-ids` off any caller context. */
export function memberOfSpaceIdsFromContext(
  ctx: Readonly<Record<string, unknown>>
): readonly string[] {
  return SpaceAuthClaimAttr.memberOfSpaceIds.from(ctx as AttributeState);
}
