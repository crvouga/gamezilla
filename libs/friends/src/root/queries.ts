import { userBlocks } from '../use-cases/block-user/shared/user-blocks-query';
import { friendRequests } from '../use-cases/list-friend-requests/shared/friend-requests-query';
import { friendships } from '../use-cases/list-friends/shared/friendships-query';
import { searchProfiles } from '../use-cases/search-friends/shared/search-profiles-query';

export const FRIENDS_QUERIES = [
  friendships,
  friendRequests,
  userBlocks,
  searchProfiles,
] as const;
