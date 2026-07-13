import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import { Hono } from 'hono';

import {
  handleAcceptFriendRequest,
  handleBlockUser,
  handleCancelFriendRequest,
  handleDeclineFriendRequest,
  handleRemoveFriend,
  handleSearchUsers,
  handleSendFriendRequest,
  handleUnblockUser,
} from './friends-route-handlers';

export function createFriendsApp(): Hono<ApiHonoEnv> {
  return new Hono<ApiHonoEnv>()
    .post('/friends/search', handleSearchUsers)
    .post('/friends/requests', handleSendFriendRequest)
    .post('/friends/requests/:id/accept', handleAcceptFriendRequest)
    .post('/friends/requests/:id/decline', handleDeclineFriendRequest)
    .post('/friends/requests/:id/cancel', handleCancelFriendRequest)
    .delete('/friends/:userId', handleRemoveFriend)
    .post('/friends/blocks', handleBlockUser)
    .delete('/friends/blocks/:userId', handleUnblockUser);
}
