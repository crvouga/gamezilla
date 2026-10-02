import type { AuthServerPort } from '@pkgs/auth/server';
import type { AuthUser, VerifiedSession } from '@pkgs/auth/shared';
import type { Clock } from '@pkgs/clock';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';
import { sql } from '@pkgs/sql';

import { IDP_PROVIDER_LABEL } from '../shared/provider-label';
import { identityJson } from './identity-handlers';
import { IdentityRepository } from './identity-repository';
import { IdpRepository } from './idp-repository';

export type CreateAuthServerAdapterDeps = {
  readonly getSql: () => SqlClient;
  readonly clock: Clock;
  readonly createId: CreateId;
  readonly secret: string;
};

function repository(deps: CreateAuthServerAdapterDeps): IdpRepository {
  return new IdpRepository(
    deps.getSql(),
    deps.clock,
    deps.createId,
    deps.secret
  );
}

async function verifySessionToken(
  deps: CreateAuthServerAdapterDeps,
  token: string
): Promise<VerifiedSession | null> {
  if (token.length === 0) return null;
  const found = await repository(deps).findSessionByToken(token);
  if (found === null) return null;
  return {
    externalUserId: found.user.id,
    accountId: null,
    email: found.user.email,
    expiresAt: new Date(found.session.expires_at),
    authenticatedAt: new Date(found.session.created_at),
  };
}

async function getUser(
  deps: CreateAuthServerAdapterDeps,
  externalUserId: string
): Promise<AuthUser | null> {
  const user = await repository(deps).findUserById(externalUserId);
  if (user === null) return null;
  const identities = await new IdentityRepository(
    deps.getSql(),
    deps.clock,
    deps.createId
  ).listForUser(externalUserId);
  return {
    externalUserId: user.id,
    email: user.email,
    displayName: user.name,
    avatarUrl: user.image,
    identities: identities.map(identityJson),
  };
}

/** The in-house IdP behind {@link AuthServerPort}, reading its own tables. */
export function createAuthServerAdapter(
  deps: CreateAuthServerAdapterDeps
): AuthServerPort {
  return {
    provider: IDP_PROVIDER_LABEL,
    verifySessionToken: (token) => verifySessionToken(deps, token),
    getUser: (externalUserId) => getUser(deps, externalUserId),
    deleteUser: async (externalUserId) => {
      const tx = deps.getSql();
        await tx.run(sql`DELETE FROM idp_sessions WHERE user_id = ${externalUserId}`);
        await tx.run(sql`DELETE FROM idp_accounts WHERE user_id = ${externalUserId}`);
        await tx.run(sql`DELETE FROM idp_link_tickets WHERE user_id = ${externalUserId}`);
        await tx.run(sql`DELETE FROM idp_pending_links WHERE target_user_id = ${externalUserId}`);
        await tx.run(sql`DELETE FROM idp_oauth_states WHERE user_id = ${externalUserId} OR link_user_id = ${externalUserId}`);
        await tx.run(sql`DELETE FROM idp_users WHERE id = ${externalUserId}`);
    },
  };
}
