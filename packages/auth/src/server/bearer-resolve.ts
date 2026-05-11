import { assertDeviceId } from '@gamezilla/auth/shared/device-id';
import {
  type AppAuthContext,
  buildAppAuthContext,
} from '@gamezilla/auth/shared/auth-context';
import { resolveAccountIdFromBearer } from '@gamezilla/api-types/auth-ports';
import type { PatchDb } from '@gamezilla/patch-db/interface';
import type { HttpBearerAuthPorts } from './ports';

export { resolveAccountIdFromBearer };

export async function buildAppAuthContextFromBearer(args: {
  db: PatchDb;
  bearerAuth: HttpBearerAuthPorts;
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
