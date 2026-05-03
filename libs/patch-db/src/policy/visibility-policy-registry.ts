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
  isPatchesDbSystemContext,
} from '../interface';

/**
 * Read context passed to a {@link VisibilityPolicy.read}. Excludes the
 * {@link PatchesDbSystemContext} branch — system reads bypass the registry
 * before reaching the policy.
 */
export type VisibilityPolicyReadContext<
  TCtx extends PatchesDbAuthContext = PatchesDbAuthContext,
> = TCtx | PatchesDbVisitorContext;

/**
 * Per-entity-type ABAC policy.
 *
 * `TCtx` lets apps narrow the authenticated branch of `read` to a richer
 * context (e.g. a base {@link PatchesDbAuthContext} intersected with
 * `accountId`, `memberOfSpaceIds`, etc). The library never inspects the extra
 * claims; `install` passes whatever context arrives from the hook through to
 * the policy.
 *
 * `read` receives either an authenticated context or a visitor context and
 * must return the where-clause to AND with the caller's query. To deny a
 * particular context (e.g. private entities for visitors) return
 * {@link READ_WHERE_NEVER_TRUE}.
 */
export type VisibilityPolicy<
  TCtx extends PatchesDbAuthContext = PatchesDbAuthContext,
> = {
  read: (ctx: VisibilityPolicyReadContext<TCtx>) => PatchesDbQueryWhereClause;
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
   *
   * System contexts bypass the registry entirely. Auth and visitor contexts
   * are passed verbatim to `policy.read`; per-policy code decides what (if
   * anything) each may see by returning `READ_WHERE_ALWAYS_TRUE`,
   * `READ_WHERE_NEVER_TRUE`, or any other where-clause.
   *
   * Writes dispatch to each entity type's `policy.write` for every non-system
   * context (including visitors). Authorization lives in those hooks only.
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

      const readCtx = ctx as VisibilityPolicyReadContext<TCtx>;
      return {
        ...query,
        where: andWhereClause(query.where, policy.read(readCtx)),
      };
    });

    const offWrite = db.hooks.beforeWrite(async (patches, ctx, tx) => {
      if (isPatchesDbSystemContext(ctx)) return patches;
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
