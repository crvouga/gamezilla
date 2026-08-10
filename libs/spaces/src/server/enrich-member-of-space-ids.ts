import { appAuth } from '@libs/auth/shared/auth-context';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { MemberOfSpaceIdsLoader } from './load-member-of-space-ids-sql';
import {
  memberOfSpaceIdsFromContext,
  SpaceAuthClaimAttr,
} from './space-auth-claim';

export class MemberOfSpaceIdsEnricher {
  private readonly loader: MemberOfSpaceIdsLoader;

  constructor(sql: SqlClient) {
    this.loader = new MemberOfSpaceIdsLoader(sql);
  }

  enrich = async (
    ctx: Readonly<Record<string, unknown>>
  ): Promise<Readonly<Record<string, unknown>>> => {
    const auth = appAuth(ctx);
    if (auth === null || auth.deviceId === '') return ctx;
    if (memberOfSpaceIdsFromContext(ctx).length > 0) return ctx;
    const ids = await this.loader.load(auth.myId);
    if (ids.length === 0) return ctx;
    return { ...ctx, ...SpaceAuthClaimAttr.memberOfSpaceIds(ids) };
  };
}
