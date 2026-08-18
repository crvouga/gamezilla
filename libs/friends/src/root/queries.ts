import { userBlocks } from '../use-cases/block-user/shared/user-blocks-query';
import { friendRequests } from '../use-cases/list-friend-requests/shared/friend-requests-query';
import { friendships } from '../use-cases/list-friends/shared/friendships-query';

export const FRIENDS_QUERIES = [
  friendships,
  friendRequests,
  userBlocks,
] as const;
