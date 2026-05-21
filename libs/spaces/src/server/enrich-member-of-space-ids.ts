/**
 * Patch-db context enricher that lazily attaches the caller's
 * `spaces/member-of-space-ids` claim. Registered at the composition root via
 * {@link PatchDb.hooks.enrichContext} so the (DB-touching) lookup runs **at
 * most once per read / write batch**, only when ABAC is actually about to
 * inspect the context.
 */
import { appAuth } from '@libs/auth/shared/auth-context';
import type { PatchDb } from '@pkgs/patch-db/interface';
import { loadMemberOfSpaceIds } from './load-member-of-space-ids';
import {
  memberOfSpaceIdsFromContext,
  SpaceAuthClaimAttr,
} from './space-auth-claim';

export function createMemberOfSpaceIdsEnricher(
  db: PatchDb
): (
  ctx: Readonly<Record<string, unknown>>
) => Promise<Readonly<Record<string, unknown>>> {
  return async (ctx) => {
    const auth = appAuth(ctx);
    if (auth === null || auth.myId === '') return ctx;
    if (memberOfSpaceIdsFromContext(ctx).length > 0) return ctx;
    const ids = await loadMemberOfSpaceIds(db, auth.myId);
    if (ids.length === 0) return ctx;
    return { ...ctx, ...SpaceAuthClaimAttr.memberOfSpaceIds(ids) };
  };
}
