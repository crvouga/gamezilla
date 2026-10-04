import type { AppAuthContext } from './auth-context';

/**
 * Authenticated sync context: signed-in account UUID (not anonymous).
 * Same shape as {@link AppAuthContext} (a claim bag); the brand here exists
 * purely so call sites can express "an `accountId` is present".
 */
export type AuthContext = AppAuthContext & {
  readonly __authenticatedAccount: true;
};
