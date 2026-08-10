import type { FriendSearchService } from './friend-search-service';

/** Thin facade used by friends routes (holds the search service). */
export class FriendService {
  constructor(private readonly searchService: FriendSearchService) {}

  searchUsers(
    args: Parameters<FriendSearchService['searchUsers']>[0]
  ): ReturnType<FriendSearchService['searchUsers']> {
    return this.searchService.searchUsers(args);
  }
}
