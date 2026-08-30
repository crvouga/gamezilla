import type { Clock } from '@pkgs/clock';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';
import { IDP_PROVIDER_LABEL } from '../shared/provider-label';
import type { AuthUserProfile } from '../shared/user-profile';
import type { VerifiedSession } from '../shared/verified-session';
import type { AuthServerPort } from './auth-server-port';
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
  const found = await repository(deps).findSessionByToken(token);
  if (found === null) return null;
  return {
    externalUserId: found.user.id,
    accountId: null,
    email: found.user.email,
    expiresAt: new Date(found.session.expires_at),
  };
}

async function getUserProfile(
  deps: CreateAuthServerAdapterDeps,
  externalUserId: string
): Promise<AuthUserProfile | null> {
  const user = await repository(deps).findUserById(externalUserId);
  if (user === null) return null;
  return {
    externalUserId: user.id,
    email: user.email,
    displayName: user.name,
    avatarUrl: user.image,
  };
}

async function getUserSnapshot(
  deps: CreateAuthServerAdapterDeps,
  externalUserId: string
): Promise<Record<string, unknown> | null> {
  const r = repository(deps);
  const user = await r.findUserById(externalUserId);
  if (user === null) return null;
  const accounts = await r.listAccounts(externalUserId);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    accounts: accounts.map((account) => ({
      id: account.id,
      providerId: account.provider,
      accountId: account.provider_user_id,
    })),
  };
}

export function createAuthServerAdapter(
  deps: CreateAuthServerAdapterDeps
): AuthServerPort {
  return {
    providerLabel: IDP_PROVIDER_LABEL,
    verifySessionToken: (token) => verifySessionToken(deps, token),
    getUserProfile: (externalUserId) => getUserProfile(deps, externalUserId),
    getUserSnapshot: (externalUserId) => getUserSnapshot(deps, externalUserId),
  };
}
