import { createClerkClient, verifyToken } from '@clerk/backend';
import type { AuthServerPort } from '@pkgs/auth/server';
import type { AuthUserProfile } from '@pkgs/auth/shared/user-profile';
import type { VerifiedSession } from '@pkgs/auth/shared/verified-session';
import { mapClerkUserToProfile } from './map-user-profile';
import { mapClerkJwtToVerifiedSession } from './map-verified-session';

export type ClerkAuthServerAdapterConfig = {
  readonly publishableKey: string;
  readonly secretKey: string;
};

async function verifyClerkSessionToken(
  token: string,
  config: ClerkAuthServerAdapterConfig
): Promise<VerifiedSession | null> {
  try {
    const payload = await verifyToken(token, {
      secretKey: config.secretKey,
    });
    return mapClerkJwtToVerifiedSession(payload);
  } catch {
    return null;
  }
}

async function loadClerkUserProfile(
  clerk: ReturnType<typeof createClerkClient>,
  externalUserId: string
): Promise<AuthUserProfile | null> {
  try {
    const user = await clerk.users.getUser(externalUserId);
    return mapClerkUserToProfile(user);
  } catch {
    return null;
  }
}

async function loadClerkUserSnapshot(
  clerk: ReturnType<typeof createClerkClient>,
  externalUserId: string
): Promise<Record<string, unknown> | null> {
  try {
    const user = await clerk.users.getUser(externalUserId);
    const raw = user.raw;
    if (raw === null) return null;
    return raw as unknown as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function createClerkAuthServerAdapter(
  config: ClerkAuthServerAdapterConfig
): AuthServerPort {
  const clerk = createClerkClient({
    secretKey: config.secretKey,
    publishableKey: config.publishableKey,
  });

  return {
    providerLabel: 'clerk',
    verifySessionToken: (token) => verifyClerkSessionToken(token, config),
    getUserProfile: (externalUserId) =>
      loadClerkUserProfile(clerk, externalUserId),
    getUserSnapshot: (externalUserId) =>
      loadClerkUserSnapshot(clerk, externalUserId),
  };
}
