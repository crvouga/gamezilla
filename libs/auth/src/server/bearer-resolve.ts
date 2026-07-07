import { assertDeviceId, assertUuid } from '@libs/auth/shared/device-id';
import {
  type AppAuthContext,
  buildAppAuthContext,
} from '@libs/auth/shared/auth-context';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import type { PatchDb } from '@pkgs/patch-db/interface';

import { ensureInternalAccountIdForExternalUser } from './account-provisioning';

/**
 * Validates the bearer token via the auth server port and resolves the internal
 * account id, or `null` if verification fails.
 */
export async function resolveAccountIdFromBearer(args: {
  db: PatchDb;
  authServer: AuthServerPort;
  bearerToken: string;
  deviceId: string;
}): Promise<string | null> {
  const { db, authServer, bearerToken, deviceId } = args;
  assertUuid(deviceId, 'deviceId must be a valid UUID');
  const trimmed = bearerToken.trim();
  if (trimmed.length === 0) return null;

  const session = await authServer.verifySessionToken(trimmed);
  if (session === null) return null;

  return await ensureInternalAccountIdForExternalUser({
    db,
    externalUserId: session.externalUserId,
    email: session.email,
    provider: authServer.providerLabel,
  });
}

export async function buildAppAuthContextFromBearer(args: {
  db: PatchDb;
  authServer: AuthServerPort;
  bearerToken: string;
  deviceId: string;
}): Promise<AppAuthContext | null> {
  const { deviceId } = args;
  const accountId = await resolveAccountIdFromBearer(args);
  if (accountId === null) return null;
  assertDeviceId(deviceId);
  return buildAppAuthContext({
    deviceId,
    accountId,
    myId: accountId,
  });
}
