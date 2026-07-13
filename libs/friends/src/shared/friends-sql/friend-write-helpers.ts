import { fail, ok, type WriteResult } from '@pkgs/write/shared/write-result';
import { requireSignedIn } from '@pkgs/write/shared/read-row-values';
import type { WriteContext } from '@pkgs/write/shared/write-context';

export function isoNow(): string {
  return new Date().toISOString();
}

export function asObjectRecord(
  raw: unknown,
  label: string
): WriteResult<Record<string, unknown>> {
  if (raw === null || typeof raw !== 'object') {
    return fail('INVALID_INPUT', `${label} must be an object`);
  }
  return ok(raw as Record<string, unknown>);
}

export function requireNonEmptyString(
  value: unknown,
  field: string
): WriteResult<string> {
  if (typeof value !== 'string' || value.length === 0) {
    return fail('INVALID_INPUT', `${field} is required`);
  }
  return ok(value);
}

export function authorizeSignedInNotSelf(
  ctx: WriteContext,
  otherUserId: string,
  selfMessage: string
): WriteResult<void> {
  const signedIn = requireSignedIn(ctx, 'FRIENDS_NOT_SIGNED_IN');
  if (signedIn !== null) return signedIn;
  if (otherUserId === ctx.myId) {
    return fail('FRIENDS_SELF', selfMessage);
  }
  return ok(undefined);
}

export function authorizeSignedIn(ctx: WriteContext): WriteResult<void> {
  return requireSignedIn(ctx, 'FRIENDS_NOT_SIGNED_IN') ?? ok(undefined);
}

export type FriendRequestIdInput = {
  readonly requestId: string;
};

export type FriendUserIdInput = {
  readonly userId: string;
};

export function parseFriendRequestIdInput(
  raw: unknown
): WriteResult<FriendRequestIdInput> {
  const record = asObjectRecord(raw, 'friend request id input');
  if (!record.ok) return record;
  const requestId = requireNonEmptyString(
    record.value['requestId'],
    'requestId'
  );
  if (!requestId.ok) return requestId;
  return ok({ requestId: requestId.value });
}

export function parseFriendUserIdInput(
  raw: unknown
): WriteResult<FriendUserIdInput> {
  const record = asObjectRecord(raw, 'friend user id input');
  if (!record.ok) return record;
  const userId = requireNonEmptyString(record.value['userId'], 'userId');
  if (!userId.ok) return userId;
  return ok({ userId: userId.value });
}
