import { friendRequests } from './friend-requests-query';
import { friendships } from './friendships-query';
import { searchProfiles } from './search-profiles-query';
import { userBlocks } from './user-blocks-query';

export const FRIENDS_QUERIES = [
  friendships,
  friendRequests,
  userBlocks,
  searchProfiles,
] as const;
