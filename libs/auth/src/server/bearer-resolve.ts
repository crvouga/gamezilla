import { assertDeviceId } from '@gamezilla/auth/shared/device-id';
import type { PatchDb } from '@gamezilla/patch-db/interface';
import type { AppAuthContext } from '@gamezilla/api/patch-db/abac-policies';
import type { HttpBearerAuthPorts } from './ports';
import { loadMemberOfSpaceIds } from './member-of-spaces';

/**
 * Validates install id + bearer token and returns the internal account id, or null.
 */
export async function resolveAccountIdFromBearer(args: {
  db: PatchDb;
  bearerAuth: HttpBearerAuthPorts;
  bearerToken: string;
  deviceId: string;
}): Promise<string | null> {
  const { db, bearerAuth, bearerToken, deviceId } = args;
  assertDeviceId(deviceId);
  const claims = await bearerAuth.sessionClaims.verifyBearer(bearerToken);
  if (claims === null) return null;
  return await bearerAuth.accountProvisioning.resolveInternalAccountId({
    db,
    claims,
  });
}

export async function buildAppAuthContextFromBearer(args: {
  db: PatchDb;
  bearerAuth: HttpBearerAuthPorts;
  bearerToken: string;
  deviceId: string;
}): Promise<AppAuthContext | null> {
  const { db, deviceId } = args;
  const accountId = await resolveAccountIdFromBearer(args);
  if (accountId === null) return null;
  assertDeviceId(deviceId);
  const memberOfSpaceIds = await loadMemberOfSpaceIds(db, accountId);
  return {
    deviceId,
    accountId,
    myId: accountId,
    memberOfSpaceIds,
    friendUserIds: [],
    blockedUserIds: [],
  } satisfies AppAuthContext;
}
