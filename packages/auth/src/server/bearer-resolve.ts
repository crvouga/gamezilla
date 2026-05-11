import { assertDeviceId } from '@gamezilla/auth/shared/device-id';
import { resolveAccountIdFromBearer } from '@gamezilla/api-types/auth-ports';
import type { PatchDb } from '@gamezilla/patch-db/interface';
import type { AppAuthContext } from '@gamezilla/patch-db/abac/app-auth-context';
import type { HttpBearerAuthPorts } from './ports';

export { resolveAccountIdFromBearer };

/**
 * Loads the set of space ids that a given user (account or device) is a
 * member of. Auth cannot depend on `@gamezilla/spaces` directly (feature ->
 * feature is forbidden by the layering rules), so the implementation is
 * supplied at the composition root in `@gamezilla/api`.
 */
export type LoadMemberOfSpaceIds = (
  db: PatchDb,
  myId: string
) => Promise<string[]>;

export async function buildAppAuthContextFromBearer(args: {
  db: PatchDb;
  bearerAuth: HttpBearerAuthPorts;
  bearerToken: string;
  deviceId: string;
  loadMemberOfSpaceIds: LoadMemberOfSpaceIds;
}): Promise<AppAuthContext | null> {
  const { db, deviceId, loadMemberOfSpaceIds } = args;
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
