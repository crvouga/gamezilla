import type { SqlClient } from '@pkgs/sql-client/interface';

import type { FriendProfile } from '../shared/friends-types';
import { listMutualFriendIds } from './friend-repository';
import { loadProfileCardsForUserIds } from './profile-projection-service';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  removeFriend,
  resolveFriendshipStatus,
  sendFriendRequest,
} from './request-service';
import { blockUser, unblockUser } from './block-service';
import { searchUsers } from './search-service';

function mapProfileCard(card: {
  readonly userId: string;
  readonly username: string;
  readonly displayName: string;
  readonly avatarConfig: string | null;
}): FriendProfile {
  return {
    userId: card.userId,
    username: card.username,
    displayName: card.displayName,
    avatarConfig: card.avatarConfig,
  };
}

export const FriendService = {
  searchUsers,
  resolveFriendshipStatus,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend,
  blockUser,
  unblockUser,
  async listMutualFriends(
    sql: SqlClient,
    viewerId: string,
    targetUserId: string
  ): Promise<readonly FriendProfile[]> {
    const ids = await listMutualFriendIds(sql, viewerId, targetUserId);
    const cards = await loadProfileCardsForUserIds(sql, ids);
    return cards.map(mapProfileCard);
  },
};
