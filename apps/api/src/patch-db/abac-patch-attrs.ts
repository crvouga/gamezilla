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
  spaceId: chatMessageNs.text('space-id', readString),
} as const;

const friendshipNs = createAttrNamespace('friendship');
export const FriendshipAttr = {
  fromUserId: friendshipNs.text('from-user-id', readString),
  toUserId: friendshipNs.text('to-user-id', readString),
} as const;

const friendRequestNs = createAttrNamespace('friend', 'request');
export const FriendRequestAttr = {
  fromUserId: friendRequestNs.text('from-user-id', readString),
  toUserId: friendRequestNs.text('to-user-id', readString),
} as const;

const matchNs = createAttrNamespace('match');
export const MatchAttr = {
  participantUserIds: matchNs.array('participant-user-ids', readStringArray),
} as const;
