/**
 * What must hold after every step, whatever happened:
 *
 * - no divergence between the system and the model was recorded;
 * - identities in the store are exactly the model's (same owner, address);
 * - no user holds two identities from one provider;
 * - every session belongs to a user, and a user with no way to sign in holds
 *   no session;
 * - every device is signed in as exactly the user the model says (or none).
 */

import sql from '@pkgs/sql-root-shared/sql';

import { sessionUserOf } from './checks';
import { expectedUser, identityKey } from './model';
import type { AuthSurface } from './types';
import { requireStore } from './types';

type IdentityRow = {
  readonly provider: string;
  readonly provider_user_id: string;
  readonly user_id: string;
  readonly email: string | null;
};

async function identityRows(s: AuthSurface): Promise<IdentityRow[]> {
  return await s.store.sql.query(sql<IdentityRow>`
    SELECT provider, provider_user_id, user_id, email
    FROM idp_accounts
    ORDER BY provider, provider_user_id
  `);
}

function modelAgreement(
  s: AuthSurface,
  rows: readonly IdentityRow[]
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = identityKey(row.provider, row.provider_user_id);
    seen.add(key);
    const expected = s.model.identities.get(key);
    if (expected === undefined) out.push(`unexpected identity ${key}`);
    else if (expected.userId !== row.user_id) {
      out.push(`${key} owned by ${row.user_id}, model says ${expected.userId}`);
    } else if (expected.email !== row.email) {
      out.push(
        `${key} address ${String(row.email)}, model says ${String(expected.email)}`
      );
    }
  }
  for (const key of s.model.identities.keys()) {
    if (!seen.has(key)) out.push(`missing identity ${key}`);
  }
  return out;
}

function onePerProvider(rows: readonly IdentityRow[]): string[] {
  const held = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const key = `${row.user_id}|${row.provider}`;
    if (held.has(key))
      out.push(`user ${row.user_id} holds two ${row.provider}`);
    held.add(key);
  }
  return out;
}

async function sessionOwners(s: AuthSurface): Promise<string[]> {
  const rows = await s.store.sql.query(sql<{
    user_id: string;
    has_user: unknown;
    identities: unknown;
  }>`
    SELECT s.user_id,
      (SELECT COUNT(*) FROM idp_users u WHERE u.id = s.user_id) AS has_user,
      (SELECT COUNT(*) FROM idp_accounts a WHERE a.user_id = s.user_id) AS identities
    FROM idp_sessions s
  `);
  const out: string[] = [];
  for (const row of rows) {
    if (Number(row.has_user) === 0)
      out.push(`session for missing user ${row.user_id}`);
    if (Number(row.identities) === 0) {
      out.push(`session for ${row.user_id}, who has no way to sign in`);
    }
  }
  return out;
}

async function deviceSessions(s: AuthSurface): Promise<string[]> {
  const out: string[] = [];
  const nowMs = s.session.ports.clock.now();
  for (const [id, actor] of s.clients) {
    const actual = await sessionUserOf(s, actor);
    const expected = expectedUser(s.model, id, nowMs);
    if (actual !== expected) {
      out.push(
        `${id} signed in as ${String(actual)}, model says ${String(expected)}`
      );
    }
  }
  return out;
}

export async function authInvariantViolations(
  surface: AuthSurface
): Promise<string[]> {
  requireStore(surface.store);
  const rows = await identityRows(surface);
  return [
    ...surface.violations,
    ...modelAgreement(surface, rows),
    ...onePerProvider(rows),
    ...(await sessionOwners(surface)),
    ...(await deviceSessions(surface)),
  ];
}

export async function assertAuthInvariants(
  surface: AuthSurface
): Promise<void> {
  const violations = await authInvariantViolations(surface);
  if (violations.length > 0) throw new Error(violations.join('\n'));
}

/** Canonical dump of the store + device bearers — the determinism fingerprint. */
export async function authFingerprint(surface: AuthSurface): Promise<string> {
  const store = requireStore(surface.store);
  const users = await store.sql.query(
    sql<{ id: string; email: string | null; name: string | null }>`
      SELECT id, email, name FROM idp_users ORDER BY id`
  );
  const accounts = await identityRows(surface);
  const sessions = await store.sql.query(
    sql<{ user_id: string; token_hash: string }>`
      SELECT user_id, token_hash FROM idp_sessions ORDER BY token_hash`
  );
  const bearers: string[] = [];
  for (const [id, actor] of surface.clients) {
    bearers.push(`${id}:${(await actor.bearerStore.read()) ?? ''}`);
  }
  return JSON.stringify({ users, accounts, sessions, bearers: bearers.sort() });
}
