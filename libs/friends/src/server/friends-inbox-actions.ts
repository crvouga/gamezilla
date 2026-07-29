import type { SqlClient } from '@pkgs/sql-client/interface';
import type { WriteDefinition } from '@pkgs/write/shared/define-write';
import { runWrite } from '@pkgs/write/shared/run-write';
import { isWriteFailure, unwrap } from '@pkgs/write/shared/write-result';
import { mapAppAuthToWriteContext } from '@libs/auth/shared/map-app-auth-to-write-context';

import { acceptFriendRequestWrite } from '../shared/accept-friend-request/accept-friend-request-write';
import { cancelFriendRequestWrite } from '../shared/cancel-friend-request/cancel-friend-request-write';
import { declineFriendRequestWrite } from '../shared/decline-friend-request/decline-friend-request-write';
import {
  deactivateFriendRequestInteraction,
  publishFriendRequestAcceptedInteraction,
} from './friends-inbox-publish';

type InboxFriendsCtx = {
  readonly sql: SqlClient;
  readonly actorId: string;
  readonly deviceId: string;
  readonly actionId: string;
  readonly requestId: string;
};

async function runInboxWrite<TInput, TOutput>(
  ctx: InboxFriendsCtx,
  write: WriteDefinition<TInput, TOutput>,
  rawInput: unknown
): Promise<TOutput> {
  const result = await runWrite({
    write,
    ctx: mapAppAuthToWriteContext({
      deviceId: ctx.deviceId,
      accountId: ctx.actorId,
      myId: ctx.actorId,
    }),
    rawInput,
    sql: ctx.sql,
    mode: 'full',
  });
  if (isWriteFailure(result)) {
    throw new Error(`${result.code}: ${result.message}`);
  }
  return unwrap(result);
}

export async function handleFriendsInboxAction(
  ctx: InboxFriendsCtx
): Promise<void> {
  if (ctx.actionId === 'accept') {
    const request = await runInboxWrite(ctx, acceptFriendRequestWrite, {
      requestId: ctx.requestId,
    });
    await deactivateFriendRequestInteraction(ctx.sql, request);
    await publishFriendRequestAcceptedInteraction(ctx.sql, request);
    return;
  }
  if (ctx.actionId === 'decline') {
    const request = await runInboxWrite(ctx, declineFriendRequestWrite, {
      requestId: ctx.requestId,
    });
    await deactivateFriendRequestInteraction(ctx.sql, request);
    return;
  }
  if (ctx.actionId === 'cancel') {
    const request = await runInboxWrite(ctx, cancelFriendRequestWrite, {
      requestId: ctx.requestId,
    });
    await deactivateFriendRequestInteraction(ctx.sql, request);
    return;
  }
  throw new Error(`Unknown friends inbox action: ${ctx.actionId}`);
}
