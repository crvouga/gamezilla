/**
 * Server is the only writer for `account_sessions` rows — they're upserted
 * exclusively by `POST /auth/refresh`. Client uploads are rejected; sign-out
 * flows clear the cached bearer + accountId in secure storage.
 */
export function rejectAccountSessionClientWrite(): never {
  throw new Error('account_sessions is server-managed');
}
