import type { Failure } from '@pkgs/rules/core/types';
import {
  FRIENDS_ALREADY_FRIENDS,
  FRIENDS_BLOCKED,
  FRIENDS_BLOCK_OWNER_MISMATCH,
  FRIENDS_COOLDOWN,
  FRIENDS_FORBIDDEN,
  FRIENDS_FRIENDSHIP_PARTY_REQUIRED,
  FRIENDS_NOT_FOUND,
  FRIENDS_NOT_SIGNED_IN,
  FRIENDS_REQUEST_EXISTS,
  FRIENDS_REQUEST_PARTY_REQUIRED,
  FRIENDS_SELF,
} from './codes';

function paramMessage(failure: Failure, fallback: string): string {
  const message = failure.params?.['message'];
  return typeof message === 'string' ? message : fallback;
}

export const FRIENDS_MESSAGES = {
  [FRIENDS_NOT_SIGNED_IN]: 'sign-in required',
  [FRIENDS_SELF]: (failure: Failure) =>
    paramMessage(failure, 'Cannot perform this action on yourself'),
  [FRIENDS_ALREADY_FRIENDS]: 'Already friends',
  [FRIENDS_REQUEST_EXISTS]: 'This user already sent you a friend request',
  [FRIENDS_BLOCKED]: 'User is blocked',
  [FRIENDS_NOT_FOUND]: (failure: Failure) =>
    paramMessage(failure, 'Friend request not found'),
  [FRIENDS_COOLDOWN]: 'Please wait before sending another request',
  [FRIENDS_FORBIDDEN]: (failure: Failure) =>
    paramMessage(failure, 'Cannot perform this friends action'),
  [FRIENDS_REQUEST_PARTY_REQUIRED]: 'not a party to this request',
  [FRIENDS_FRIENDSHIP_PARTY_REQUIRED]: 'not a party to this friendship',
  [FRIENDS_BLOCK_OWNER_MISMATCH]: 'owner mismatch',
} as const satisfies Readonly<
  Record<string, string | ((failure: Failure) => string)>
>;
