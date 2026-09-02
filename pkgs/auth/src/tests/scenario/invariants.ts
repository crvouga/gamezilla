import type { World } from '@pkgs/determinism';
import { sql } from '@pkgs/sql';
import {
  AUTH_SET_TOKEN_HEADER,
  IDP_PROVIDER_DEV,
  IDP_PROVIDER_GOOGLE,
} from '../../shared/auth-constants';
import {
  type ActorState,
  type AuthKit,
  type AuthStore,
  requireStore,
} from './types';

type AuthWorld = World<
  Record<string, import('@pkgs/determinism').KnobDef>,
  Record<string, import('@pkgs/determinism').NodeEntry>,
  AuthKit
>;

export async function assertAuthInvariants(world: AuthWorld): Promise<void> {
  const store = requireStore(world.nodes['store'] as AuthStore);
  const actors = world.nodes['client'] as ReadonlyMap<string, ActorState>;
  for (const [id, actor] of actors) {
    if (actor.bearer === null) continue;
    const verified = await store.server.verifySessionToken(actor.bearer);
    if (verified === null) continue;
    if (verified.externalUserId.length === 0) {
      throw new Error(
        `session_has_external_user_id: actor ${id} verified session missing externalUserId`
      );
    }
  }
}

/** Canonical dump of IdP state + actor bearers — the determinism fingerprint. */
export async function worldFingerprint(world: AuthWorld): Promise<string> {
  const store = requireStore(world.nodes['store'] as AuthStore);
  const actors = world.nodes['client'] as ReadonlyMap<string, ActorState>;
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
  const bearers = [...actors.entries()]
    .map(([id, actor]) => `${id}:${actor.bearer ?? ''}`)
    .sort();
  return JSON.stringify({ users, accounts, sessions, bearers });
}

export type OauthProvider =
  | typeof IDP_PROVIDER_GOOGLE
  | typeof IDP_PROVIDER_DEV;

export { AUTH_SET_TOKEN_HEADER, IDP_PROVIDER_DEV, IDP_PROVIDER_GOOGLE };
