import { ForbiddenError } from '@pkgs/patch-db/forbidden-error';

/**
 * Server is the only writer for `account/session` rows — they're upserted
 * exclusively by `POST /auth/refresh` (system context bypasses ABAC). Any
 * authenticated client patch is rejected with a 403; sign-out flows clear the
 * client's cached bearer + accountId in secure storage and let the next
 * `/auth/refresh` from another device rotate the row.
 */
export function rejectAccountSessionClientWrite(): never {
  throw new ForbiddenError('accountSession is server-managed');
}
