import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import { Hono } from 'hono';

import {
  handleAcceptFriendRequest,
  handleBlockUser,
  handleCancelFriendRequest,
  handleDeclineFriendRequest,
  handleFriendshipStatus,
  handleMutualFriends,
  handleRemoveFriend,
  handleSearchUsers,
  handleSendFriendRequest,
  handleUnblockUser,
} from './friends-route-handlers';
import {
  handleListFriendRequests,
  handleReadFriendUser,
} from './friends-read-handlers';

export function createFriendsApp(): Hono<ApiHonoEnv> {
  return new Hono<ApiHonoEnv>()
    .post('/friends/search', handleSearchUsers)
    .get('/friends/requests', handleListFriendRequests)
    .get('/friends/users/:userId', handleReadFriendUser)
    .get('/friends/status/:userId', handleFriendshipStatus)
    .post('/friends/requests', handleSendFriendRequest)
    .post('/friends/requests/:id/accept', handleAcceptFriendRequest)
    .post('/friends/requests/:id/decline', handleDeclineFriendRequest)
    .post('/friends/requests/:id/cancel', handleCancelFriendRequest)
    .delete('/friends/:userId', handleRemoveFriend)
    .post('/friends/blocks', handleBlockUser)
    .delete('/friends/blocks/:userId', handleUnblockUser)
    .get('/friends/mutual/:userId', handleMutualFriends);
}
