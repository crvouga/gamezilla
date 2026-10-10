/**
 * Who an actor is, outside the app: their Google address, and the product
 * account and username the server gave them. Everything here reads the
 * server, so it answers the same at every fidelity — including a localhost
 * stack, where each actor's own database lives inside their browser.
 */
import {
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_TOKEN_KEY,
} from '@libs/auth-shared/auth-storage-keys';
import { HARNESS_AUTH_SECRET } from '@libs/feature-shared/harness-constants';
import { hashAuthSecret } from '@pkgs/auth-inhouse-shared/token-hash';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import type { ProductHarness } from './harness';
import { productExtra } from './harness';
import { harnessIdpEmail } from './idp';

/** The Google address the person behind `actorId` signs in with. */
export function actorEmail(s: ProductHarness, actorId: string): string {
  const http = productExtra(s).http;
  return http.kind === 'stack'
    ? harnessIdpEmail(`${actorId}.${http.accountTag}`)
    : harnessIdpEmail(actorId);
}

/**
 * Which of the person's two Apple Accounts: the one registered with their
 * Gmail address (the same person as their Google account, by address) or
 * the iCloud one (a different address).
 */
export type AppleAccountKind = 'gmail' | 'icloud';

export function actorAppleEmail(
  s: ProductHarness,
  actorId: string,
  kind: AppleAccountKind
): string {
  const gmail = actorEmail(s, actorId);
  if (kind === 'gmail') return gmail;
  return `${gmail.slice(0, gmail.indexOf('@'))}@icloud.com`;
}

/** The actor's product account id, or `null` before they have signed in. */
export async function accountIdOf(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  const rows = await s.harness.serverSql.sqlClient.query(sql<{
    readonly user_id: string;
  }>`
    SELECT a.user_id
    FROM auth_external_accounts a
    JOIN idp_users u ON u.id = a.external_id
    WHERE a.provider = 'idp'
      AND u.email = ${actorEmail(s, actorId)}
      AND a.deleted_at IS NULL
    LIMIT 1`);
  return rows[0]?.user_id ?? null;
}

/**
 * The actor's local database (their synced copy), wherever the actor runs,
 * or `null` before the app has opened one.
 */
export function actorLocalSql(
  s: ProductHarness,
  actorId: string
): SqlTx | null {
  const actor = s.actors.get(actorId);
  if (actor !== undefined) return actor.localSql();
  return s.harness.clientSql(actorId)?.sqlClient ?? null;
}

/** The identity the device retains for local work, including a guest. */
export async function deviceMemberIdOf(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  const env = await s.harness.client(actorId);
  const id = env.secureStorage.getValue(LAST_LOCAL_ACCOUNT_ID_KEY);
  return typeof id === 'string' ? id : null;
}

/** The sign-in methods (providers) the server links to a product account. */
export async function serverSignInMethodsOf(
  s: ProductHarness,
  accountId: string
): Promise<string[]> {
  const rows = await s.harness.serverSql.sqlClient.query(sql<{
    readonly provider: string;
  }>`
    SELECT i.provider
    FROM idp_accounts i
    JOIN auth_external_accounts a ON a.external_id = i.user_id
    WHERE a.provider = 'idp'
      AND a.user_id = ${accountId}
      AND a.deleted_at IS NULL
    ORDER BY i.provider`);
  return rows.map((row) => row.provider);
}

/**
 * The sign-in methods as the device sees them: its synced mirror rows
 * (what the account screen renders). The local copy outlives a session, so
 * a device that has held several accounts keeps rows of each: pass
 * `accountId` to read only that account's, as the account screen does.
 */
export async function localSignInMethodsOf(
  s: ProductHarness,
  actorId: string,
  accountId?: string
): Promise<string[]> {
  const local = actorLocalSql(s, actorId);
  if (local === null) return [];
  const rows = await local.query(
    accountId === undefined
      ? sql<{ readonly provider: string }>`
    SELECT provider FROM auth_external_accounts
    WHERE provider IN ('google', 'apple') AND deleted_at IS NULL
    ORDER BY provider`
      : sql<{ readonly provider: string }>`
    SELECT provider FROM auth_external_accounts
    WHERE provider IN ('google', 'apple') AND deleted_at IS NULL
      AND user_id = ${accountId}
    ORDER BY provider`
  );
  return rows.map((row) => row.provider);
}

/** The product account the device is signed in to, per its synced copy. */
export async function localAccountIdOf(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  const local = actorLocalSql(s, actorId);
  if (local === null) return null;
  const rows = await local.query(sql<{ readonly user_id: string }>`
    SELECT user_id FROM auth_external_accounts
    WHERE provider = 'idp' AND deleted_at IS NULL
    ORDER BY updated_at DESC
    LIMIT 1`);
  return rows[0]?.user_id ?? null;
}

/**
 * The product account the device is signed in to, by the server's own
 * verdict: the device's bearer must name a live session. A revoked or
 * expired session reads as signed out even before the device notices.
 */
export async function signedInAccountOf(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  const env = await s.harness.client(actorId);
  const actor = s.actors.get(actorId);
  const token =
    actor === undefined
      ? env.secureStorage.getValue(SESSION_TOKEN_KEY)
      : await actor.sessionToken();
  if (typeof token !== 'string' || token.length === 0) return null;
  const rows = await s.harness.serverSql.sqlClient.query(sql<{
    readonly user_id: string;
    readonly expires_at: unknown;
  }>`
    SELECT a.user_id, se.expires_at
    FROM idp_sessions se
    JOIN auth_external_accounts a ON a.external_id = se.user_id
    WHERE se.token_hash = ${hashAuthSecret(HARNESS_AUTH_SECRET, token)}
      AND a.provider = 'idp'
      AND a.deleted_at IS NULL
    LIMIT 1`);
  const row = rows[0];
  if (row === undefined) return null;
  const expires =
    row.expires_at instanceof Date
      ? row.expires_at.getTime()
      : Date.parse(String(row.expires_at));
  return expires > s.harness.clock.now() ? row.user_id : null;
}
