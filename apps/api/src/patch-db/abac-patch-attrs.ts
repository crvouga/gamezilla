/**
 * {@link AttributeTag}s for PatchDB keys referenced by API ABAC / visibility
 * policies (not yet modeled in a dedicated feature package).
 */
import { createAttrNamespace } from '@pkgs/attribute';

export { AbacEntityAttr } from '@pkgs/patch-db/abac/abac-entity-attr';

function readString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function readStringArray(v: unknown): readonly string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

const chatMessageNs = createAttrNamespace('chat', 'message');
export const ChatMessageAttr = {
  /** ABAC: chat rows are visibility-scoped by space. */
  spaceId: chatMessageNs.text('space-id', readString).indexed(),
} as const;

const friendshipNs = createAttrNamespace('friendship');
export const FriendshipAttr = {
  /** ABAC: friendship rows are visibility-scoped to participants. */
  fromUserId: friendshipNs.text('from-user-id', readString).indexed(),
  toUserId: friendshipNs.text('to-user-id', readString).indexed(),
} as const;

const friendRequestNs = createAttrNamespace('friend', 'request');
export const FriendRequestAttr = {
  /** ABAC: friend requests are visibility-scoped to participants. */
  fromUserId: friendRequestNs.text('from-user-id', readString).indexed(),
  toUserId: friendRequestNs.text('to-user-id', readString).indexed(),
} as const;

const matchNs = createAttrNamespace('match');
export const MatchAttr = {
  /** Note: `array` data type — not indexable as a scalar column.
   * Visibility filtering with array containment must use the JSONB GIN
   * index or be reshaped (e.g. one membership row per (matchId, userId)). */
  participantUserIds: matchNs.array('participant-user-ids', readStringArray),
} as const;
