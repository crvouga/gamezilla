import { IDP_PROVIDER_LABEL } from '@pkgs/auth-inhouse-shared/provider-label';
import type { AuthServerPort } from '@pkgs/auth-root-shared/auth-server-port';
import type { AuthUser } from '@pkgs/auth-root-shared/auth-user';
import type { VerifiedSession } from '@pkgs/auth-root-shared/verified-session';
import type { Clock } from '@pkgs/clock-shared/types';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
import { identityJson } from './identity-handlers';
import { IdentityRepository } from './identity-repository';
import { IdpRepository } from './idp-repository';
import { SYNTHETIC_MONITOR_USER } from './synthetic-monitor';

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
    synthetic: found.user.id === SYNTHETIC_MONITOR_USER.id,
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
      // Links still in the mail for the user's address go with the user.
      await tx.run(sql`
        DELETE FROM idp_email_links WHERE email IN (
          SELECT provider_user_id FROM idp_accounts
          WHERE user_id = ${externalUserId} AND provider = ${'email'}
        )
      `);
      await tx.run(
        sql`DELETE FROM idp_sessions WHERE user_id = ${externalUserId}`
      );
      await tx.run(
        sql`DELETE FROM idp_accounts WHERE user_id = ${externalUserId}`
      );
      await tx.run(
        sql`DELETE FROM idp_link_tickets WHERE user_id = ${externalUserId}`
      );
      await tx.run(
        sql`DELETE FROM idp_pending_links WHERE target_user_id = ${externalUserId}`
      );
      await tx.run(
        sql`DELETE FROM idp_oauth_states WHERE user_id = ${externalUserId} OR link_user_id = ${externalUserId}`
      );
      await tx.run(sql`DELETE FROM idp_users WHERE id = ${externalUserId}`);
    },
  };
}
