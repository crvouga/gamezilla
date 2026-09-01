import type { InvariantViolation, World } from '@pkgs/determinism';
import { sql } from '@pkgs/sql';
import { type AuthSystem, requireStore } from './types';

type AuthWorld = World<AuthSystem>;

export async function checkAuthInvariants(
  world: AuthWorld
): Promise<InvariantViolation | null> {
  const store = requireStore(world.state);
  for (const [id, actor] of world.state.actors) {
    if (actor.bearer === null) continue;
    const verified = await store.server.verifySessionToken(actor.bearer);
    if (verified === null) continue;
    if (verified.externalUserId.length === 0) {
      return {
        invariant: 'session_has_external_user_id',
        detail: `actor ${id} verified session missing externalUserId`,
      };
    }
  }
  return null;
}

export async function assertAuthInvariants(world: AuthWorld): Promise<void> {
  const violation = await checkAuthInvariants(world);
  if (violation !== null) {
    throw new Error(`${violation.invariant}: ${violation.detail}`);
  }
}

/** Canonical dump of IdP state + actor bearers — the determinism fingerprint. */
export async function worldFingerprint(world: AuthWorld): Promise<string> {
  const store = requireStore(world.state);
  const users = await store.sql.query(
    sql<{
      id: string;
      email: string | null;
      name: string | null;
    }>`SELECT id, email, name FROM idp_users ORDER BY id`
  );
  const accounts = await store.sql.query(sql<{
    provider: string;
    provider_user_id: string;
    user_id: string;
  }>`
    SELECT provider, provider_user_id, user_id
    FROM idp_accounts
    ORDER BY provider, provider_user_id
  `);
  const sessions = await store.sql.query(sql<{
    user_id: string;
    token_hash: string;
  }>`
    SELECT user_id, token_hash FROM idp_sessions ORDER BY token_hash
  `);
  const bearers = [...world.state.actors.entries()]
    .map(([id, actor]) => `${id}:${actor.bearer ?? ''}`)
    .sort();
  return JSON.stringify({ users, accounts, sessions, bearers });
}
