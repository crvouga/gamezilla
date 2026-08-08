import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import type { AuthUserProfile } from '@pkgs/auth/shared/user-profile';
import type { VerifiedSession } from '@pkgs/auth/shared/verified-session';

import { BETTER_AUTH_PROVIDER_LABEL } from '../shared/provider-label';
import type { BetterAuthInstance } from './create-better-auth';

export { BETTER_AUTH_PROVIDER_LABEL };

function bearerHeaders(token: string): Headers {
  return new Headers({ Authorization: `Bearer ${token}` });
}

async function verifySessionToken(
  auth: BetterAuthInstance,
  token: string
): Promise<VerifiedSession | null> {
  try {
    const session = await auth.api.getSession({
      headers: bearerHeaders(token),
    });
    if (session === null) return null;
    return {
      externalUserId: session.user.id,
      accountId: null,
      email: session.user.email ?? null,
      expiresAt: new Date(session.session.expiresAt),
    };
  } catch {
    return null;
  }
}

async function loadUserProfile(
  auth: BetterAuthInstance,
  externalUserId: string
): Promise<AuthUserProfile | null> {
  try {
    const ctx = await auth.$context;
    const user = await ctx.internalAdapter.findUserById(externalUserId);
    if (user === null) return null;
    return {
      externalUserId: user.id,
      email: user.email ?? null,
      displayName: user.name ?? null,
      avatarUrl: user.image ?? null,
    };
  } catch {
    return null;
  }
}

async function loadUserSnapshot(
  auth: BetterAuthInstance,
  externalUserId: string
): Promise<Record<string, unknown> | null> {
  try {
    const ctx = await auth.$context;
    const user = await ctx.internalAdapter.findUserById(externalUserId);
    if (user === null) return null;
    const accounts = await ctx.internalAdapter.findAccounts(externalUserId);
    return {
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
      image: user.image ?? null,
      emailVerified: user.emailVerified ?? false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      accounts: accounts.map((account) => ({
        id: account.id,
        providerId: account.providerId,
        accountId: account.accountId,
        createdAt: account.createdAt,
      })),
    };
  } catch {
    return null;
  }
}

export function createBetterAuthServerAdapter(
  auth: BetterAuthInstance
): AuthServerPort {
  return {
    providerLabel: BETTER_AUTH_PROVIDER_LABEL,
    verifySessionToken: (token) => verifySessionToken(auth, token),
    getUserProfile: (externalUserId) => loadUserProfile(auth, externalUserId),
    getUserSnapshot: (externalUserId) => loadUserSnapshot(auth, externalUserId),
  };
}
