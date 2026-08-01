import {
  PROFILE_DELETE_DENIED,
  PROFILE_ID_MISMATCH,
} from './codes';

export const PROFILE_MESSAGES = {
  [PROFILE_ID_MISMATCH]: 'id mismatch',
  [PROFILE_DELETE_DENIED]: 'profiles cannot be deleted via sync',
} as const satisfies Readonly<Record<string, string>>;
