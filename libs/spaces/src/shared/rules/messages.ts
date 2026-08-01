import type { Failure } from '@pkgs/rules/core/types';
import {
  SIGN_IN_REQUIRED,
  SPACE_DELETE_DENIED,
  SPACE_ENDED,
  SPACE_HOST_REQUIRED,
  SPACE_INVALID_INPUT,
  SPACE_NOT_FOUND,
  SPACE_NOT_SIGNED_IN,
  SPACE_VISIBILITY_DENIED,
  SPACE_WRITE_DENIED,
} from './codes';

function paramMessage(failure: Failure, fallback: string): string {
  const message = failure.params?.['message'];
  return typeof message === 'string' ? message : fallback;
}

export const SPACE_MESSAGES = {
  [SPACE_NOT_SIGNED_IN]: 'Sign in to continue',
  [SPACE_NOT_FOUND]: 'Space not found',
  [SPACE_ENDED]: 'Space has ended',
  [SPACE_VISIBILITY_DENIED]: 'Not allowed to join this space',
  [SPACE_HOST_REQUIRED]: (failure: Failure) =>
    paramMessage(failure, 'Only the host can perform this action'),
  [SPACE_WRITE_DENIED]: (failure: Failure) =>
    paramMessage(failure, 'Only the host can patch this space'),
  [SPACE_DELETE_DENIED]: 'spaces cannot be deleted via sync',
  [SPACE_INVALID_INPUT]: (failure: Failure) =>
    paramMessage(failure, 'Invalid space input'),
  [SIGN_IN_REQUIRED]: 'Sign in to make a space public',
} as const satisfies Readonly<
  Record<string, string | ((failure: Failure) => string)>
>;
