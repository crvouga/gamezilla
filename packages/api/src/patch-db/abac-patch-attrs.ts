/**
 * {@link AttributeTag}s for PatchDB keys referenced by API ABAC / visibility
 * policies (not yet modeled in a dedicated feature package).
 */
import { createAttrNamespace } from '@gamezilla/attribute';

export { AbacEntityAttr } from '@gamezilla/patch-db/abac/abac-entity-attr';

const passthrough = (v: unknown) => v;

const chatMessageNs = createAttrNamespace('chat', 'message');
export const ChatMessageAttr = {
  spaceId: chatMessageNs('space-id', passthrough),
} as const;

const friendshipNs = createAttrNamespace('friendship');
export const FriendshipAttr = {
  fromUserId: friendshipNs('from-user-id', passthrough),
  toUserId: friendshipNs('to-user-id', passthrough),
} as const;

const friendRequestNs = createAttrNamespace('friend', 'request');
export const FriendRequestAttr = {
  fromUserId: friendRequestNs('from-user-id', passthrough),
  toUserId: friendRequestNs('to-user-id', passthrough),
} as const;

const matchNs = createAttrNamespace('match');
export const MatchAttr = {
  participantUserIds: matchNs('participant-user-ids', passthrough),
} as const;
