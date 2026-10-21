import { appAuth } from '@libs/auth-shared-ts/auth-context';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';

import { MemberOfSpaceIdsLoader } from './load-member-of-space-ids-sql';
import {
  memberOfSpaceIdsFromContext,
  SpaceAuthClaimAttr,
} from './space-auth-claim';

export class MemberOfSpaceIdsEnricher {
  constructor(private readonly tx: SqlTx) {}

  enrich = async (
    ctx: Readonly<Record<string, unknown>>
  ): Promise<Readonly<Record<string, unknown>>> => {
    const auth = appAuth(ctx);
    if (auth === null || auth.deviceId === '') return ctx;
    if (memberOfSpaceIdsFromContext(ctx).length > 0) return ctx;
    const ids = await new MemberOfSpaceIdsLoader(this.tx).load(auth.myId);
    if (ids.length === 0) return ctx;
    return { ...ctx, ...SpaceAuthClaimAttr.memberOfSpaceIds(ids) };
  };
}
