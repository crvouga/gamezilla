import { assertDeviceId, assertUuid } from '@libs/auth/shared/device-id';
import {
  type AppAuthContext,
  buildAppAuthContext,
} from '@libs/auth/shared/auth-context';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { ensureInternalAccountIdForExternalUser } from './account-provisioning';
import { findUserIdByDeviceId } from './anon-user-ensure';

/**
 * Validates the bearer token via the auth server port and resolves the internal
 * account id, or `null` if verification fails.
 *
 * When the device is bound to an anon user and this external identity is new,
 * that anon row is upgraded in place.
 */
export async function resolveAccountIdFromBearer(args: {
  sql: SqlClient;
  authServer: AuthServerPort;
  bearerToken: string;
  deviceId: string;
}): Promise<string | null> {
  const { sql, authServer, bearerToken, deviceId } = args;
  assertUuid(deviceId, 'deviceId must be a valid UUID');
  const trimmed = bearerToken.trim();
  if (trimmed.length === 0) return null;

  const session = await authServer.verifySessionToken(trimmed);
  if (session === null) return null;

  const upgradeUserId = await findUserIdByDeviceId(sql, deviceId);

  return await ensureInternalAccountIdForExternalUser({
    sql,
    authServer,
    externalUserId: session.externalUserId,
    upgradeUserId,
  });
}

export async function buildAppAuthContextFromBearer(args: {
  sql: SqlClient;
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
    isAnon: false,
  });
}
