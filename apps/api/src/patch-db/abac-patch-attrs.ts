/**
 * {@link AttributeTag}s for PatchDB keys referenced by API ABAC / visibility
 * policies (not yet modeled in @gamezilla/domain).
 */
import { createAttrNamespace } from '@gamezilla/lib/attribute';

const passthrough = (v: unknown) => v;

const entityNs = createAttrNamespace('entity');
export const AbacEntityAttr = {
  owner: entityNs('owner', passthrough),
} as const;

const chatMessageNs = createAttrNamespace('chat.message');
export const ChatMessageAttr = {
  spaceId: chatMessageNs('spaceId', passthrough),
} as const;

const friendshipNs = createAttrNamespace('friendship');
export const FriendshipAttr = {
  fromUserId: friendshipNs('fromUserId', passthrough),
  toUserId: friendshipNs('toUserId', passthrough),
} as const;

const friendRequestNs = createAttrNamespace('friend.request');
export const FriendRequestAttr = {
  fromUserId: friendRequestNs('fromUserId', passthrough),
  toUserId: friendRequestNs('toUserId', passthrough),
} as const;

const matchNs = createAttrNamespace('match');
export const MatchAttr = {
  participantUserIds: matchNs('participantUserIds', passthrough),
} as const;
