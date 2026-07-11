import { fail, ok } from '@pkgs/write/shared/write-result';
import { requireSignedIn } from '@pkgs/write/shared/read-row-values';
import type { WriteContext } from '@pkgs/write/shared/write-context';

export type SendFriendRequestInput = {
  readonly toUserId: string;
  readonly message?: string | null;
};

export function parseSendFriendRequestInput(
  raw: unknown
): ReturnType<typeof ok<SendFriendRequestInput>> | ReturnType<typeof fail> {
  if (raw === null || typeof raw !== 'object') {
    return fail('INVALID_INPUT', 'send friend request input must be an object');
  }
  const record = raw as Record<string, unknown>;
  const toUserId = record['toUserId'];
  if (typeof toUserId !== 'string' || toUserId.length === 0) {
    return fail('INVALID_INPUT', 'toUserId is required');
  }
  const message = record['message'];
  return ok({
    toUserId,
    ...(typeof message === 'string' ? { message } : {}),
  });
}

export async function authorizeSendFriendRequest(
  ctx: WriteContext,
  input: SendFriendRequestInput
): Promise<ReturnType<typeof ok<void>> | ReturnType<typeof fail>> {
  const signedIn = requireSignedIn(ctx, 'FRIENDS_NOT_SIGNED_IN');
  if (signedIn !== null) return signedIn;
  if (input.toUserId === ctx.myId) {
    return fail('FRIENDS_SELF', 'Cannot perform this action on yourself');
  }
  return ok(undefined);
}
