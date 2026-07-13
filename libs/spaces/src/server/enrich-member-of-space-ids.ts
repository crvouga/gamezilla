import { appAuth } from '@libs/auth/shared/auth-context';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { loadMemberOfSpaceIdsFromSql } from './load-member-of-space-ids-sql';
import {
  memberOfSpaceIdsFromContext,
  SpaceAuthClaimAttr,
} from './space-auth-claim';

export function createMemberOfSpaceIdsEnricher(
  sql: SqlClient
): (
  ctx: Readonly<Record<string, unknown>>
) => Promise<Readonly<Record<string, unknown>>> {
  return async (ctx) => {
    const auth = appAuth(ctx);
    if (auth === null || auth.deviceId === '') return ctx;
    if (memberOfSpaceIdsFromContext(ctx).length > 0) return ctx;
    const ids = await loadMemberOfSpaceIdsFromSql(sql, auth.deviceId);
    if (ids.length === 0) return ctx;
    return { ...ctx, ...SpaceAuthClaimAttr.memberOfSpaceIds(ids) };
  };
}
