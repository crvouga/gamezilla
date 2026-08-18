/**
 * Auth snapshot for non-React HTTP callers. Built from hooks at the React
 * boundary — never read via global secure-storage getters.
 */

export type ClientRequestAuth = {
  readonly sessionToken: string | null;
  readonly deviceId: string | null;
  readonly accountId: string | null;
};

/** Must match {@link ANON_ID_HEADER} in session-middleware. */
const X_ANON_ID = 'x-anon-id';

export function clientAuthHeaders(
  auth: ClientRequestAuth,
  options?: { readonly requireAccountIdForBearer?: boolean }
): Record<string, string> {
  const requireAccount = options?.requireAccountIdForBearer === true;
  const token = auth.sessionToken;
  const deviceId = auth.deviceId;
  const accountId = auth.accountId;
  const bearerOk =
    token !== null &&
    token.length > 0 &&
    (!requireAccount || accountId !== null);

  if (bearerOk) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    if (deviceId !== null && deviceId.length > 0) {
      headers[X_ANON_ID] = deviceId;
    }
    return headers;
  }
  if (deviceId !== null && deviceId.length > 0) {
    return { [X_ANON_ID]: deviceId, 'Content-Type': 'application/json' };
  }
  return { 'Content-Type': 'application/json' };
}
