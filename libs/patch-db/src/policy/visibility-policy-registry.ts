import { assert } from '@gamezilla/lib/assert';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { ForbiddenError } from '../forbidden-error';
import type {
  PatchDb,
  PatchDbAuthContext,
  PatchDbBeforeWriteHookResult,
  PatchDbContext,
  PatchDbQuery,
  PatchDbQueryWhereClause,
  PatchDbClientContext,
  PatchInput,
  PatchRejectionReason,
} from '../interface';
import {
  andWhereClause,
  denyAllReadsQuery,
  isPatchDbSystemContext,
  READ_WHERE_ALWAYS_TRUE,
  READ_WHERE_NEVER_TRUE,
} from '../interface';

/**
 * Read context passed to a {@link VisibilityPolicy.read}. Excludes the
 * {@link PatchDbSystemContext} branch — system reads bypass the registry
 * before reaching the policy.
 */
export type VisibilityPolicyReadContext<
  TCtx extends PatchDbAuthContext = PatchDbAuthContext,
> = TCtx | PatchDbClientContext;

/**
 * Per-entity-type ABAC policy.
 *
 * `TCtx` lets apps narrow the authenticated branch of `read` to a richer
 * context (e.g. a base {@link PatchDbAuthContext} intersected with
 * `userId`, `memberOfSpaceIds`, etc). The library never inspects the extra
 * claims; `install` passes whatever context arrives from the hook through to
 * the policy.
 *
 * `read` receives either an authenticated context or a client-only context and
 * must return the where-clause to AND with the caller's query. To deny a
 * particular context (e.g. private entities for unauthenticated clients) return
 * {@link READ_WHERE_NEVER_TRUE}.
 */
export type VisibilityPolicy<
  TCtx extends PatchDbAuthContext = PatchDbAuthContext,
> = {
  read: (ctx: VisibilityPolicyReadContext<TCtx>) => PatchDbQueryWhereClause;
  write: (
    ctx: PatchDbContext,
    patch: PatchInput,
    tx: SqlClient
  ) => void | Promise<void>;
};

export class VisibilityPolicyRegistry<
  TCtx extends PatchDbAuthContext = PatchDbAuthContext,
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
   * Wires ABAC read filtering + write checks onto {@link PatchDb.hooks}.
   * Returns an unsubscribe that removes both hook registrations.
   *
   * System contexts bypass the registry entirely. Auth and client contexts
   * are passed verbatim to `policy.read`; per-policy code decides what (if
   * anything) each may see by returning `READ_WHERE_ALWAYS_TRUE`,
   * `READ_WHERE_NEVER_TRUE`, or any other where-clause.
   *
   * Writes dispatch to each entity type's `policy.write` for every non-system
   * context (including client-only). Authorization lives in those hooks only.
   */
  install(db: PatchDb): () => void {
    const offRead = db.hooks.beforeRead((query, ctx) =>
      this.applyReadPolicy(query, ctx)
    );
    const offWrite = db.hooks.beforeWrite((patches, ctx, tx) =>
      this.applyWritePolicy(patches, ctx, tx)
    );

    return () => {
      offRead();
      offWrite();
    };
  }

  private applyReadPolicy(
    query: PatchDbQuery,
    ctx: PatchDbContext
  ): PatchDbQuery {
    if (isPatchDbSystemContext(ctx)) return query;

    if (query.entityType === undefined || query.entityType === '') {
      return denyAllReadsQuery(query);
    }
    const policy = this.policies.get(query.entityType);
    if (policy === undefined) {
      return denyAllReadsQuery(query);
    }

    const readCtx = ctx as VisibilityPolicyReadContext<TCtx>;
    const filter = policy.read(readCtx);
    // Short-circuit the sentinels: `READ_WHERE_*` are encoded as
    // `exists/not_exists patch/createdById` (a JSON-path key the snapshot
    // recompute strips out via PATCH_META_KEYS). They evaluate correctly,
    // but ANDing them onto every read forces redundant JSON probes in the
    // generated SQL, which floods the dev DB log and adds real work to
    // every poll. NEVER_TRUE reuses the existing `denyAllReadsQuery`
    // (LIMIT 0) path; ALWAYS_TRUE skips the where merge entirely.
    if (filter === READ_WHERE_NEVER_TRUE) {
      return denyAllReadsQuery(query);
    }
    if (filter === READ_WHERE_ALWAYS_TRUE) {
      return query;
    }
    return {
      ...query,
      where: andWhereClause(query.where, filter),
    };
  }

  private async applyWritePolicy(
    patches: PatchInput[],
    ctx: PatchDbContext,
    tx: SqlClient
  ): Promise<PatchDbBeforeWriteHookResult> {
    if (isPatchDbSystemContext(ctx)) {
      return { accepted: patches, rejected: [] };
    }
    const accepted: PatchInput[] = [];
    const rejected: PatchRejectionReason[] = [];
    const truncate = (s: string): string => s.slice(0, 256);
    for (const p of patches) {
      assert.ok(
        typeof p.patchId === 'string' && p.patchId.length > 0,
        'visibility beforeWrite expects patchId (assign before hooks in impl)'
      );
      const patchId = p.patchId;
      const policy = this.policies.get(p.entityType);
      if (policy === undefined) {
        rejected.push({
          patchId,
          code: 'unknown_entity_type',
          reason: truncate(
            `no visibility policy for entity type ${p.entityType}`
          ),
          patch: p,
        });
        continue;
      }
      try {
        await policy.write(ctx, p, tx);
        accepted.push(p);
      } catch (e: unknown) {
        if (e instanceof ForbiddenError) {
          rejected.push({
            patchId,
            code: 'forbidden',
            reason: truncate(e.message),
            patch: p,
          });
          continue;
        }
        throw e;
      }
    }
    return { accepted, rejected };
  }
}
