import {
  AUTH_DEVICE_ID_MISMATCH,
  AUTH_DEVICE_REQUIRED,
  AUTH_SERVER_MANAGED,
} from './codes';

export const AUTH_MESSAGES = {
  [AUTH_DEVICE_ID_MISMATCH]: 'id mismatch',
  [AUTH_DEVICE_REQUIRED]: 'device writes require x-anon-id',
  [AUTH_SERVER_MANAGED]: 'write denied',
} as const satisfies Readonly<Record<string, string>>;
