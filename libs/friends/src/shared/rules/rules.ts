import { friendsSendBeforeRule } from './rules-send';
import {
  friendsBlockOwnerAfterRule,
  friendsBlockOwnerBeforeRule,
  friendsFriendshipPartyAfterRule,
  friendsFriendshipPartyBeforeRule,
  friendsRequestPartyAfterRule,
  friendsRequestPartyBeforeRule,
} from './rules-party';

export { FRIENDS_MESSAGES } from './messages';
export * from './codes';
export { isResendCooldownActive, FRIEND_REQUEST_RESEND_COOLDOWN_MS } from './cooldown';

export const FRIENDS_RULES = [
  friendsSendBeforeRule,
  friendsRequestPartyBeforeRule,
  friendsRequestPartyAfterRule,
  friendsFriendshipPartyBeforeRule,
  friendsFriendshipPartyAfterRule,
  friendsBlockOwnerBeforeRule,
  friendsBlockOwnerAfterRule,
] as const;
