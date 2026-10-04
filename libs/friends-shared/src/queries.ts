import { userBlocks } from './user-blocks-query';
import { friendRequests } from './friend-requests-query';
import { friendships } from './friendships-query';
import { searchProfiles } from './search-profiles-query';

export const FRIENDS_QUERIES = [
  friendships,
  friendRequests,
  userBlocks,
  searchProfiles,
] as const;
