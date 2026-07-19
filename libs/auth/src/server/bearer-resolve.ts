import { assertDeviceId, assertUuid } from '@libs/auth/shared/device-id';
import {
  type AppAuthContext,
  buildAppAuthContext,
} from '@libs/auth/shared/auth-context';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { ensureInternalAccountIdForExternalUser } from './account-provisioning';

/**
 * Validates the bearer token via the auth server port and resolves the internal
 * account id, or `null` if verification fails.
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
  // #region agent log
  await fetch(
    'http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '11af44',
      },
      body: JSON.stringify({
        sessionId: '11af44',
        hypothesisId: 'G',
        location: 'bearer-resolve.ts:resolveAccountIdFromBearer',
        message: 'verifySessionToken result',
        data: {
          sessionNull: session === null,
          externalUserId: session?.externalUserId ?? null,
          tokenLen: trimmed.length,
        },
        timestamp: Date.now(),
      }),
    }
  ).catch(() => {});
  // #endregion
  if (session === null) return null;

  return await ensureInternalAccountIdForExternalUser({
    sql,
    authServer,
    externalUserId: session.externalUserId,
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
  });
}
