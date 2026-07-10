import { assertUuid } from '@libs/auth/shared/device-id';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { upsertAuthUserSnapshot } from './entity-store-sql';
import {
  findUserIdByPrimaryAuthExternalId,
  insertUser,
  upsertExternalAccount,
} from './external-accounts-sql';

export async function ensureInternalAccountIdForExternalUser(args: {
  sql: SqlClient;
  authServer: AuthServerPort;
  externalUserId: string;
}): Promise<string> {
  const { sql, authServer, externalUserId } = args;
  const existingUserId = await findUserIdByPrimaryAuthExternalId(
    sql,
    authServer.providerLabel,
    externalUserId
  );
  if (existingUserId !== null) {
    assertUuid(existingUserId, 'userId must be UUID');
    return existingUserId;
  }

  const snapshot = await authServer.getUserSnapshot(externalUserId);
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  await insertUser(sql, userId, now);
  await upsertExternalAccount(sql, {
    userId,
    provider: authServer.providerLabel,
    externalId: externalUserId,
    metadata: {},
  });
  await upsertAuthUserSnapshot(sql, {
    externalUserId,
    ownerId: userId,
    data: snapshot ?? { id: externalUserId },
  });
  return userId;
}
