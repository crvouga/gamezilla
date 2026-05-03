import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { ForbiddenError } from '../forbidden-error';
import type {
  PatchInput,
  PatchesDb,
  PatchesDbAuthContext,
  PatchesDbContext,
  PatchesDbQueryWhereClause,
  PatchesDbVisitorContext,
} from '../interface';
import {
  andWhereClause,
  denyAllReadsQuery,
  isPatchesDbAuthContext,
  isPatchesDbSystemContext,
  isPatchesDbVisitorContext,
} from '../interface';

/**
 * Per-entity-type ABAC policy.
 *
 * `TCtx` lets apps narrow `read` to a richer context (e.g. a base
 * {@link PatchesDbAuthContext} intersected with `accountId`, `memberOfSpaceIds`,
 * etc). The library never inspects the extra claims; `install` passes whatever
 * context arrives from the hook through to the policy.
 *
 * `visitorRead` is called for anonymous visitors (cookie-only, no Bearer).
 * When omitted, visitor reads are denied for this entity type.
 */
export type VisibilityPolicy<
  TCtx extends PatchesDbAuthContext = PatchesDbAuthContext,
> = {
  read: (ctx: TCtx) => PatchesDbQueryWhereClause;
  visitorRead?: (ctx: PatchesDbVisitorContext) => PatchesDbQueryWhereClause;
  write: (
    ctx: PatchesDbContext,
    patch: PatchInput,
    tx: SqlClient
  ) => void | Promise<void>;
};

export class VisibilityPolicyRegistry<
  TCtx extends PatchesDbAuthContext = PatchesDbAuthContext,
> {
  private readonly policies = new Map<string, VisibilityPolicy<TCtx>>();

  register(entityType: string, policy: VisibilityPolicy<TCtx>): this {
    this.policies.set(entityType, policy);
    return this;
  }

  registerAll(entries: Readonly<Record<string, VisibilityPolicy<TCtx>>>): this {
    for (const [k, v] of Object.entries(entries)) {
      this.policies.set(k, v);
    }
    return this;
  }

  get(entityType: string): VisibilityPolicy<TCtx> | undefined {
    return this.policies.get(entityType);
  }

  /**
   * Wires ABAC read filtering + write checks onto {@link PatchesDb.hooks}.
   * Returns an unsubscribe that removes both hook registrations.
   */
  install(db: PatchesDb): () => void {
    const offRead = db.hooks.beforeRead((query, ctx) => {
      if (isPatchesDbSystemContext(ctx)) return query;

      if (query.entityType === undefined || query.entityType === '') {
        return denyAllReadsQuery(query);
      }
      const policy = this.policies.get(query.entityType);
      if (policy === undefined) {
        return denyAllReadsQuery(query);
      }

      if (isPatchesDbVisitorContext(ctx)) {
        if (policy.visitorRead === undefined) {
          return denyAllReadsQuery(query);
        }
        return {
          ...query,
          where: andWhereClause(query.where, policy.visitorRead(ctx)),
        };
      }

      if (!isPatchesDbAuthContext(ctx)) {
        return denyAllReadsQuery(query);
      }
      return {
        ...query,
        where: andWhereClause(query.where, policy.read(ctx as TCtx)),
      };
    });

    const offWrite = db.hooks.beforeWrite(async (patches, ctx, tx) => {
      if (isPatchesDbSystemContext(ctx)) return patches;
      if (isPatchesDbVisitorContext(ctx)) {
        throw new ForbiddenError('visitors cannot write patches');
      }
      for (const p of patches) {
        const policy = this.policies.get(p.entityType);
        if (policy === undefined) {
          throw new ForbiddenError('no visibility policy for entity type', {
            entityType: p.entityType,
          });
        }
        await policy.write(ctx, p, tx);
      }
      return patches;
    });

    return () => {
      offRead();
      offWrite();
    };
  }
}
