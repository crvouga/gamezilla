import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { ForbiddenError } from '../forbidden-error';
import type {
  PatchInput,
  PatchesDb,
  PatchesDbContext,
  PatchesDbQueryWhereClause,
} from '../interface';
import {
  andWhereClause,
  denyAllReadsQuery,
  isPatchesDbAuthContext,
  isPatchesDbSystemContext,
} from '../interface';

import type { PatchesDbAuthContext } from '../interface';

export type VisibilityPolicy = {
  read: (ctx: PatchesDbAuthContext) => PatchesDbQueryWhereClause;
  write: (
    ctx: PatchesDbContext,
    patch: PatchInput,
    tx: SqlClient
  ) => void | Promise<void>;
};

export class VisibilityPolicyRegistry {
  private readonly policies = new Map<string, VisibilityPolicy>();

  register(entityType: string, policy: VisibilityPolicy): void {
    this.policies.set(entityType, policy);
  }

  registerAll(entries: Readonly<Record<string, VisibilityPolicy>>): void {
    for (const [k, v] of Object.entries(entries)) {
      this.policies.set(k, v);
    }
  }

  get(entityType: string): VisibilityPolicy | undefined {
    return this.policies.get(entityType);
  }

  /**
   * Wires ABAC read filtering + write checks onto {@link PatchesDb.hooks}.
   * Returns an unsubscribe that removes both hook registrations.
   */
  install(db: PatchesDb): () => void {
    const offRead = db.hooks.beforeRead((query, ctx) => {
      if (isPatchesDbSystemContext(ctx)) return query;
      if (!isPatchesDbAuthContext(ctx)) {
        return denyAllReadsQuery(query);
      }
      if (query.entityType === undefined || query.entityType === '') {
        return denyAllReadsQuery(query);
      }
      const policy = this.policies.get(query.entityType);
      if (policy === undefined) {
        return denyAllReadsQuery(query);
      }
      return {
        ...query,
        where: andWhereClause(query.where, policy.read(ctx)),
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
