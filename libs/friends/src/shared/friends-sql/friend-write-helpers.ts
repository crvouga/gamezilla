import { fail } from '@pkgs/rules/core/fail';
import { throwRulesReject } from '@pkgs/rules/core/rules-reject';
import type { AppRulesAuth } from '@libs/auth/shared/app-rules-auth';
import {
  FRIENDS_NOT_SIGNED_IN,
  FRIENDS_SELF,
} from '@libs/friends/shared/rules/codes';

export function isoNow(): string {
  return new Date().toISOString();
}

export function asObjectRecord(
  raw: unknown,
  label: string
): Record<string, unknown> {
  if (raw === null || typeof raw !== 'object') {
    throwRulesReject([
      fail('INVALID_INPUT', {
        params: { message: `${label} must be an object` },
      }),
    ]);
  }
  return raw as Record<string, unknown>;
}

export function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throwRulesReject([
      fail('INVALID_INPUT', { params: { message: `${field} is required` } }),
    ]);
  }
  return value;
}

export function requireSignedIn(auth: AppRulesAuth): void {
  if (auth.accountId === null || auth.isAnon) {
    throwRulesReject([fail(FRIENDS_NOT_SIGNED_IN)]);
  }
}

export function authorizeSignedInNotSelf(
  auth: AppRulesAuth,
  otherUserId: string,
  selfMessage: string
): void {
  requireSignedIn(auth);
  if (otherUserId === auth.userId) {
    throwRulesReject([
      fail(FRIENDS_SELF, { params: { message: selfMessage } }),
    ]);
  }
}

export type FriendRequestIdInput = {
  readonly requestId: string;
};

export type FriendUserIdInput = {
  readonly userId: string;
};

export function parseFriendRequestIdInput(raw: unknown): FriendRequestIdInput {
  const record = asObjectRecord(raw, 'friend request id input');
  const requestId = requireNonEmptyString(record['requestId'], 'requestId');
  return { requestId };
}

export function parseFriendUserIdInput(raw: unknown): FriendUserIdInput {
  const record = asObjectRecord(raw, 'friend user id input');
  const userId = requireNonEmptyString(record['userId'], 'userId');
  return { userId };
}
