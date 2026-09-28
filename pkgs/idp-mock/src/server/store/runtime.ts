/**
 * Runtime state: browser sessions, parked authorize requests, codes, tokens
 * and consent grants. Everything here is hard-deleted when its TTL passes —
 * none of it is user-visible history, so tombstones would only grow the file.
 */

import { raw, type Sql, sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';

import type {
  IdpAccessToken,
  IdpAuthCode,
  IdpAuthRequest,
  IdpBrowserSession,
  IdpGrant,
  IdpRefreshToken,
  IdpRelayAddress,
} from '../../shared/types';
import {
  ACCESS_TOKEN_COLUMNS,
  AUTH_CODE_COLUMNS,
  AUTH_REQUEST_COLUMNS,
  bindBool,
  encodeJson,
  GRANT_COLUMNS,
  mapAccessToken,
  mapAuthCode,
  mapAuthRequest,
  mapGrant,
  mapRefreshToken,
  mapRelayAddress,
  mapSession,
  REFRESH_TOKEN_COLUMNS,
  RELAY_COLUMNS,
  rowInt,
  rowText,
  SESSION_COLUMNS,
} from './codec';

type Row = Record<string, unknown>;

async function selectOne<T>(
  db: SqlTx,
  query: Sql<Row>,
  map: (row: Row) => T
): Promise<T | null> {
  const rows = await db.query(query);
  const row = rows[0];
  return row === undefined ? null : map(row);
}

export async function selectSession(
  db: SqlTx,
  sessionId: string
): Promise<IdpBrowserSession | null> {
  return await selectOne(
    db,
    sql<Row>`SELECT ${raw(SESSION_COLUMNS)} FROM idp_mock_sessions WHERE id = ${sessionId}`,
    mapSession
  );
}

export async function insertSession(
  db: SqlTx,
  session: IdpBrowserSession
): Promise<void> {
  await db.run(
    sql`INSERT INTO idp_mock_sessions (id, signed_in) VALUES (${session.id}, ${encodeJson(session.signedIn)})`
  );
}

export async function writeSessionSignedIn(
  db: SqlTx,
  sessionId: string,
  signedIn: readonly string[]
): Promise<void> {
  await db.run(
    sql`UPDATE idp_mock_sessions SET signed_in = ${encodeJson(signedIn)} WHERE id = ${sessionId}`
  );
}

export async function selectAuthRequest(
  db: SqlTx,
  id: string
): Promise<IdpAuthRequest | null> {
  return await selectOne(
    db,
    sql<Row>`SELECT ${raw(AUTH_REQUEST_COLUMNS)} FROM idp_mock_auth_requests WHERE id = ${id}`,
    mapAuthRequest
  );
}

export async function insertAuthRequest(
  db: SqlTx,
  request: IdpAuthRequest
): Promise<void> {
  await db.run(
    sql`INSERT INTO idp_mock_auth_requests
      (id, client_id, redirect_uri, scopes, state, nonce, code_challenge, code_challenge_method, access_type, prompts, login_hint, created_at_ms, chosen_sub, identifier_email, response_type, response_mode)
      VALUES (
        ${request.id}, ${request.clientId}, ${request.redirectUri},
        ${encodeJson(request.scopes)}, ${request.state}, ${request.nonce},
        ${request.codeChallenge}, ${encodeJson(request.codeChallengeMethod)},
        ${encodeJson(request.accessType)}, ${encodeJson(request.prompts)},
        ${request.loginHint}, ${request.createdAtMs}, ${request.chosenSub},
        ${request.identifierEmail}, ${request.responseType},
        ${request.responseMode}
      )`
  );
}

export async function setAuthRequestChosen(
  db: SqlTx,
  id: string,
  sub: string | null
): Promise<void> {
  await db.run(
    sql`UPDATE idp_mock_auth_requests SET chosen_sub = ${sub} WHERE id = ${id}`
  );
}

/** Park the address from the identifier step while the password is checked. */
export async function setAuthRequestIdentifier(
  db: SqlTx,
  id: string,
  email: string | null
): Promise<void> {
  await db.run(
    sql`UPDATE idp_mock_auth_requests SET identifier_email = ${email} WHERE id = ${id}`
  );
}

export async function deleteAuthRequest(db: SqlTx, id: string): Promise<void> {
  await db.run(sql`DELETE FROM idp_mock_auth_requests WHERE id = ${id}`);
}

export async function selectAuthCode(
  db: SqlTx,
  code: string
): Promise<IdpAuthCode | null> {
  return await selectOne(
    db,
    sql<Row>`SELECT ${raw(AUTH_CODE_COLUMNS)} FROM idp_mock_auth_codes WHERE id = ${code}`,
    mapAuthCode
  );
}

export async function insertAuthCode(
  db: SqlTx,
  code: IdpAuthCode
): Promise<void> {
  await db.run(
    sql`INSERT INTO idp_mock_auth_codes
      (id, client_id, redirect_uri, sub, scopes, nonce, code_challenge, code_challenge_method, issue_refresh_token, expires_at_ms, redeemed, first_authorization, auth_time_ms)
      VALUES (
        ${code.code}, ${code.clientId}, ${code.redirectUri}, ${code.sub},
        ${encodeJson(code.scopes)}, ${code.nonce}, ${code.codeChallenge},
        ${encodeJson(code.codeChallengeMethod)},
        ${bindBool(code.issueRefreshToken)}, ${code.expiresAtMs},
        ${bindBool(code.redeemed)}, ${bindBool(code.firstAuthorization)},
        ${code.authTimeMs}
      )`
  );
}

/** Google invalidates the whole grant when a code is replayed. */
export async function redeemAuthCode(db: SqlTx, code: string): Promise<void> {
  await db.run(
    sql`UPDATE idp_mock_auth_codes SET redeemed = 1 WHERE id = ${code}`
  );
}

export async function selectAccessToken(
  db: SqlTx,
  token: string
): Promise<IdpAccessToken | null> {
  return await selectOne(
    db,
    sql<Row>`SELECT ${raw(ACCESS_TOKEN_COLUMNS)} FROM idp_mock_access_tokens WHERE id = ${token}`,
    mapAccessToken
  );
}

export async function insertAccessToken(
  db: SqlTx,
  token: IdpAccessToken
): Promise<void> {
  await db.run(
    sql`INSERT INTO idp_mock_access_tokens (id, sub, client_id, scopes, expires_at_ms)
      VALUES (${token.token}, ${token.sub}, ${token.clientId}, ${encodeJson(token.scopes)}, ${token.expiresAtMs})`
  );
}

export async function deleteAccessToken(
  db: SqlTx,
  token: string
): Promise<void> {
  await db.run(sql`DELETE FROM idp_mock_access_tokens WHERE id = ${token}`);
}

export async function selectRefreshToken(
  db: SqlTx,
  token: string
): Promise<IdpRefreshToken | null> {
  return await selectOne(
    db,
    sql<Row>`SELECT ${raw(REFRESH_TOKEN_COLUMNS)} FROM idp_mock_refresh_tokens WHERE id = ${token}`,
    mapRefreshToken
  );
}

export async function insertRefreshToken(
  db: SqlTx,
  token: IdpRefreshToken
): Promise<void> {
  await db.run(
    sql`INSERT INTO idp_mock_refresh_tokens (id, sub, client_id, scopes, revoked)
      VALUES (${token.token}, ${token.sub}, ${token.clientId}, ${encodeJson(token.scopes)}, ${bindBool(token.revoked)})`
  );
}

export async function revokeRefreshToken(
  db: SqlTx,
  token: string
): Promise<void> {
  await db.run(
    sql`UPDATE idp_mock_refresh_tokens SET revoked = 1 WHERE id = ${token}`
  );
}

/** `sub|clientId` → the app's standing authorization. */
export async function selectGrant(
  db: SqlTx,
  key: string
): Promise<IdpGrant | null> {
  return await selectOne(
    db,
    sql<Row>`SELECT ${raw(GRANT_COLUMNS)} FROM idp_mock_grants WHERE id = ${key}`,
    mapGrant
  );
}

export async function selectGrantsForSub(
  db: SqlTx,
  sub: string
): Promise<IdpGrant[]> {
  const rows = await db.query(
    sql<Row>`SELECT ${raw(GRANT_COLUMNS)} FROM idp_mock_grants WHERE sub = ${sub} ORDER BY id`
  );
  return rows.map(mapGrant);
}

export async function writeGrant(
  db: SqlTx,
  key: string,
  grant: IdpGrant
): Promise<void> {
  const scopes = encodeJson(grant.scopes);
  const updated = await db.run(
    sql`UPDATE idp_mock_grants SET scopes = ${scopes}, email_choice = ${grant.emailChoice} WHERE id = ${key}`
  );
  if (updated.changes === 0) {
    await db.run(
      sql`INSERT INTO idp_mock_grants (id, sub, client_id, scopes, email_choice)
        VALUES (${key}, ${grant.sub}, ${grant.clientId}, ${scopes}, ${grant.emailChoice})`
    );
  }
}

export async function deleteGrant(db: SqlTx, key: string): Promise<void> {
  await db.run(sql`DELETE FROM idp_mock_grants WHERE id = ${key}`);
}

export async function selectRelayAddress(
  db: SqlTx,
  key: string
): Promise<IdpRelayAddress | null> {
  return await selectOne(
    db,
    sql<Row>`SELECT ${raw(RELAY_COLUMNS)} FROM idp_mock_relay_addresses WHERE id = ${key}`,
    mapRelayAddress
  );
}

export async function selectRelayAddressByEmail(
  db: SqlTx,
  email: string
): Promise<IdpRelayAddress | null> {
  return await selectOne(
    db,
    sql<Row>`SELECT ${raw(RELAY_COLUMNS)} FROM idp_mock_relay_addresses WHERE email = ${email}`,
    mapRelayAddress
  );
}

export async function insertRelayAddress(
  db: SqlTx,
  key: string,
  relay: IdpRelayAddress
): Promise<void> {
  await db.run(
    sql`INSERT INTO idp_mock_relay_addresses (id, sub, team_id, email, forwarding)
      VALUES (${key}, ${relay.sub}, ${relay.teamId}, ${relay.email}, ${bindBool(relay.forwarding)})`
  );
}

export async function writeRelayForwarding(
  db: SqlTx,
  key: string,
  forwarding: boolean
): Promise<void> {
  await db.run(
    sql`UPDATE idp_mock_relay_addresses SET forwarding = ${bindBool(forwarding)} WHERE id = ${key}`
  );
}

/** Everything an account owns outside the directory row itself. */
export async function deleteAccountState(
  db: SqlTx,
  sub: string
): Promise<void> {
  await db.run(sql`DELETE FROM idp_mock_grants WHERE sub = ${sub}`);
  await db.run(sql`DELETE FROM idp_mock_access_tokens WHERE sub = ${sub}`);
  await db.run(
    sql`UPDATE idp_mock_refresh_tokens SET revoked = 1 WHERE sub = ${sub}`
  );
  await db.run(sql`DELETE FROM idp_mock_relay_addresses WHERE sub = ${sub}`);
}

/**
 * Drop everything time has invalidated so the file cannot grow without bound.
 */
export async function sweepExpiredRows(
  db: SqlTx,
  bounds: {
    readonly authRequestsBeforeMs: number;
    readonly authCodesBeforeMs: number;
    readonly accessTokensBeforeMs: number;
  }
): Promise<void> {
  await db.run(
    sql`DELETE FROM idp_mock_auth_requests WHERE created_at_ms < ${bounds.authRequestsBeforeMs}`
  );
  await db.run(
    sql`DELETE FROM idp_mock_auth_codes WHERE expires_at_ms < ${bounds.authCodesBeforeMs}`
  );
  await db.run(
    sql`DELETE FROM idp_mock_access_tokens WHERE expires_at_ms < ${bounds.accessTokensBeforeMs}`
  );
}

/** A replayed code kills every access + refresh token for that grant. */
export async function revokeGrantTokens(
  db: SqlTx,
  sub: string,
  clientId: string
): Promise<void> {
  await db.run(
    sql`DELETE FROM idp_mock_access_tokens WHERE sub = ${sub} AND client_id = ${clientId}`
  );
  await db.run(
    sql`UPDATE idp_mock_refresh_tokens SET revoked = 1 WHERE sub = ${sub} AND client_id = ${clientId}`
  );
}

export async function deleteSessions(db: SqlTx): Promise<void> {
  await db.run(sql`DELETE FROM idp_mock_sessions`);
}

/** Forget every browser session, grant, code and token; keep the directory. */
export async function deleteRuntimeState(db: SqlTx): Promise<void> {
  await db.run(sql`DELETE FROM idp_mock_sessions`);
  await db.run(sql`DELETE FROM idp_mock_auth_requests`);
  await db.run(sql`DELETE FROM idp_mock_auth_codes`);
  await db.run(sql`DELETE FROM idp_mock_access_tokens`);
  await db.run(sql`DELETE FROM idp_mock_refresh_tokens`);
  await db.run(sql`DELETE FROM idp_mock_grants`);
}

/** Everything `/__idp/state` reports, in one place. */
export type IdpStats = {
  readonly sessions: readonly IdpBrowserSession[];
  readonly grants: readonly {
    readonly key: string;
    readonly scopes: readonly string[];
  }[];
  readonly pendingAuthRequests: number;
  readonly liveAccessTokens: number;
};

export async function selectStats(db: SqlTx): Promise<IdpStats> {
  const sessionRows = await db.query(
    sql<Row>`SELECT ${raw(SESSION_COLUMNS)} FROM idp_mock_sessions ORDER BY id`
  );
  const grantRows = await db.query(
    sql<Row>`SELECT id, scopes FROM idp_mock_grants ORDER BY id`
  );
  const requestRows = await db.query(
    sql<Row>`SELECT COUNT(*) AS n FROM idp_mock_auth_requests`
  );
  const tokenRows = await db.query(
    sql<Row>`SELECT COUNT(*) AS n FROM idp_mock_access_tokens`
  );
  return {
    sessions: sessionRows.map(mapSession),
    grants: grantRows.map((row) => ({
      key: rowText(row, 'id'),
      scopes: JSON.parse(rowText(row, 'scopes')) as readonly string[],
    })),
    pendingAuthRequests: rowInt(requestRows[0] ?? {}, 'n'),
    liveAccessTokens: rowInt(tokenRows[0] ?? {}, 'n'),
  };
}
