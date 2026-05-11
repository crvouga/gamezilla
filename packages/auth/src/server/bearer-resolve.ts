import { assertDeviceId, assertUuid } from '@gamezilla/auth/shared/device-id';
import {
  type AppAuthContext,
  buildAppAuthContext,
} from '@gamezilla/auth/shared/auth-context';
import type { PatchDb } from '@gamezilla/patch-db/interface';

import { ensureInternalAccountIdForExternalUser } from './better-auth-account-provisioning';
import type { HostedBetterAuth } from './better-auth-create';

/**
 * Validates the bearer token via Better Auth and resolves the internal account
 * id, or `null` if verification fails.
 */
export async function resolveAccountIdFromBearer(args: {
  db: PatchDb;
  auth: HostedBetterAuth;
  bearerToken: string;
  deviceId: string;
}): Promise<string | null> {
  const { db, auth, bearerToken, deviceId } = args;
  assertUuid(deviceId, 'deviceId must be a valid UUID');
  const trimmed = bearerToken.trim();
  if (trimmed.length === 0) return null;
  let session: Awaited<ReturnType<typeof auth.api.getSession>>;
  try {
    session = await auth.api.getSession({
      headers: new Headers({ authorization: `Bearer ${trimmed}` }),
    });
  } catch {
    return null;
  }
  if (session === null || session.user === undefined) return null;
  const { id, email } = session.user;
  if (typeof id !== 'string' || id.length === 0) return null;
  return await ensureInternalAccountIdForExternalUser({
    db,
    externalUserId: id,
    email: typeof email === 'string' ? email : null,
  });
}

export async function buildAppAuthContextFromBearer(args: {
  db: PatchDb;
  auth: HostedBetterAuth;
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
