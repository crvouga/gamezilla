/**
 * Row <-> shape mapping for the IdP's own tables. SQLite hands back physical
 * values (TEXT / INTEGER / JSON-as-TEXT), so every read is asserted here and
 * every write's encoding lives next to its decode.
 */

import type {
  IdpAccessToken,
  IdpAccount,
  IdpAuthCode,
  IdpAuthRequest,
  IdpBrowserSession,
  IdpClient,
  IdpPrompt,
  IdpRefreshToken,
} from '../../shared/types';

export type IdpRow = Record<string, unknown>;

function fail(column: string, expected: string): never {
  throw new Error(`idp_sim: expected ${expected} in column '${column}'`);
}

export function rowText(row: IdpRow, column: string): string {
  const value = row[column];
  if (typeof value !== 'string') return fail(column, 'text');
  return value;
}

export function rowNullableText(row: IdpRow, column: string): string | null {
  const value = row[column];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return fail(column, 'text or null');
  return value;
}

export function rowInt(row: IdpRow, column: string): number {
  const value = row[column];
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  return fail(column, 'integer');
}

export function rowBool(row: IdpRow, column: string): boolean {
  const value = row[column];
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === 0) return value === 1;
  return fail(column, 'boolean');
}

export function rowJson<T>(row: IdpRow, column: string): T {
  const value = row[column];
  if (typeof value !== 'string') return fail(column, 'JSON text');
  return JSON.parse(value) as T;
}

/** Booleans bind as 0/1 so STRICT INTEGER columns accept them everywhere. */
export function bindBool(value: boolean): number {
  return value ? 1 : 0;
}

export function encodeJson(value: unknown): string {
  return JSON.stringify(value);
}

export const ACCOUNT_COLUMNS =
  'id, email, email_verified, name, given_name, family_name, picture, hd';
export const CLIENT_COLUMNS = 'id, client_secret, redirect_uris, app_name';
export const SESSION_COLUMNS = 'id, signed_in';
export const AUTH_REQUEST_COLUMNS =
  'id, client_id, redirect_uri, scopes, state, nonce, code_challenge, code_challenge_method, access_type, prompts, login_hint, created_at_ms, chosen_sub, identifier_email';
export const AUTH_CODE_COLUMNS =
  'id, client_id, redirect_uri, sub, scopes, nonce, code_challenge, code_challenge_method, issue_refresh_token, expires_at_ms, redeemed';
export const ACCESS_TOKEN_COLUMNS = 'id, sub, client_id, scopes, expires_at_ms';
export const REFRESH_TOKEN_COLUMNS = 'id, sub, client_id, scopes, revoked';

export function mapAccount(row: IdpRow): IdpAccount {
  return {
    sub: rowText(row, 'id'),
    email: rowText(row, 'email'),
    emailVerified: rowBool(row, 'email_verified'),
    name: rowText(row, 'name'),
    givenName: rowText(row, 'given_name'),
    familyName: rowText(row, 'family_name'),
    picture: rowText(row, 'picture'),
    hd: rowNullableText(row, 'hd'),
  };
}

export function mapClient(row: IdpRow): IdpClient {
  return {
    clientId: rowText(row, 'id'),
    clientSecret: rowText(row, 'client_secret'),
    redirectUris: rowJson<readonly string[]>(row, 'redirect_uris'),
    appName: rowText(row, 'app_name'),
  };
}

export function mapSession(row: IdpRow): IdpBrowserSession {
  return {
    id: rowText(row, 'id'),
    signedIn: [...rowJson<readonly string[]>(row, 'signed_in')],
  };
}

export function mapAuthRequest(row: IdpRow): IdpAuthRequest {
  return {
    id: rowText(row, 'id'),
    clientId: rowText(row, 'client_id'),
    redirectUri: rowText(row, 'redirect_uri'),
    scopes: rowJson<readonly string[]>(row, 'scopes'),
    state: rowNullableText(row, 'state'),
    nonce: rowNullableText(row, 'nonce'),
    codeChallenge: rowNullableText(row, 'code_challenge'),
    codeChallengeMethod: rowJson<'S256' | 'plain' | null>(
      row,
      'code_challenge_method'
    ),
    accessType: rowJson<'online' | 'offline'>(row, 'access_type'),
    prompts: rowJson<readonly IdpPrompt[]>(row, 'prompts'),
    loginHint: rowNullableText(row, 'login_hint'),
    createdAtMs: rowInt(row, 'created_at_ms'),
    chosenSub: rowNullableText(row, 'chosen_sub'),
    identifierEmail: rowNullableText(row, 'identifier_email'),
  };
}

export function mapAuthCode(row: IdpRow): IdpAuthCode {
  return {
    code: rowText(row, 'id'),
    clientId: rowText(row, 'client_id'),
    redirectUri: rowText(row, 'redirect_uri'),
    sub: rowText(row, 'sub'),
    scopes: rowJson<readonly string[]>(row, 'scopes'),
    nonce: rowNullableText(row, 'nonce'),
    codeChallenge: rowNullableText(row, 'code_challenge'),
    codeChallengeMethod: rowJson<'S256' | 'plain' | null>(
      row,
      'code_challenge_method'
    ),
    issueRefreshToken: rowBool(row, 'issue_refresh_token'),
    expiresAtMs: rowInt(row, 'expires_at_ms'),
    redeemed: rowBool(row, 'redeemed'),
  };
}

export function mapAccessToken(row: IdpRow): IdpAccessToken {
  return {
    token: rowText(row, 'id'),
    sub: rowText(row, 'sub'),
    clientId: rowText(row, 'client_id'),
    scopes: rowJson<readonly string[]>(row, 'scopes'),
    expiresAtMs: rowInt(row, 'expires_at_ms'),
  };
}

export function mapRefreshToken(row: IdpRow): IdpRefreshToken {
  return {
    token: rowText(row, 'id'),
    sub: rowText(row, 'sub'),
    clientId: rowText(row, 'client_id'),
    scopes: rowJson<readonly string[]>(row, 'scopes'),
    revoked: rowBool(row, 'revoked'),
  };
}
