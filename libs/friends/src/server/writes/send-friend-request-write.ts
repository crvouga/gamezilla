import { isFriendsError } from '../../shared/friends-errors';
import { defineWrite } from '@pkgs/write/shared/define-write';
import { fail, ok } from '@pkgs/write/shared/write-result';
import { writeStoreAsSqlClient } from '@pkgs/write/server/write-store-as-sql-client';

import { sendFriendRequest as sendFriendRequestService } from '../request-service';
import {
  authorizeSendFriendRequest,
  parseSendFriendRequestInput,
  type SendFriendRequestInput,
} from '../../shared/writes/send-friend-request-input';

export const sendFriendRequestWrite = defineWrite<
  SendFriendRequestInput,
  Awaited<ReturnType<typeof sendFriendRequestService>>
>({
  name: 'friends.sendRequest',
  parseInput: parseSendFriendRequestInput,
  authorize: authorizeSendFriendRequest,
  execute: async (ctx, input, store) => {
    try {
      const request = await sendFriendRequestService(
        writeStoreAsSqlClient(store),
        ctx.myId,
        input.toUserId,
        input.message ?? null
      );
      return ok(request);
    } catch (error) {
      if (isFriendsError(error)) {
        return fail(error.code, error.message);
      }
      throw error;
    }
  },
});
