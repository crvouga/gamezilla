import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import type {
  Patch,
  PatchesDbContext,
  PatchesDbQuery,
  PatchInput,
  PatchesDbHooks,
  Unsubscribe,
} from './interface';

type BeforeReadFn = (
  query: PatchesDbQuery,
  ctx: PatchesDbContext
) => PatchesDbQuery | Promise<PatchesDbQuery>;

type BeforeWriteFn = (
  patches: PatchInput[],
  ctx: PatchesDbContext,
  tx: SqlClient
) => PatchInput[] | Promise<PatchInput[]>;

type AfterWriteFn = (
  written: Patch[],
  ctx: PatchesDbContext,
  tx: SqlClient
) => void | Promise<void>;

/**
 * Composable hook lists; {@link PatchDbImplSqlite} / {@link PatchDbImplPostgres}
 * invoke these inside the read path and inside the write transaction.
 */
export class PatchDbHookRegistry implements PatchesDbHooks {
  private beforeReadFns: BeforeReadFn[] = [];
  private beforeWriteFns: BeforeWriteFn[] = [];
  private afterWriteFns: AfterWriteFn[] = [];

  beforeRead(fn: BeforeReadFn): Unsubscribe {
    this.beforeReadFns.push(fn);
    return () => {
      const i = this.beforeReadFns.indexOf(fn);
      if (i >= 0) this.beforeReadFns.splice(i, 1);
    };
  }

  beforeWrite(fn: BeforeWriteFn): Unsubscribe {
    this.beforeWriteFns.push(fn);
    return () => {
      const i = this.beforeWriteFns.indexOf(fn);
      if (i >= 0) this.beforeWriteFns.splice(i, 1);
    };
  }

  afterWrite(fn: AfterWriteFn): Unsubscribe {
    this.afterWriteFns.push(fn);
    return () => {
      const i = this.afterWriteFns.indexOf(fn);
      if (i >= 0) this.afterWriteFns.splice(i, 1);
    };
  }

  async runBeforeRead(
    query: PatchesDbQuery,
    ctx: PatchesDbContext
  ): Promise<PatchesDbQuery> {
    let q = query;
    for (const fn of this.beforeReadFns) {
      q = await fn(q, ctx);
    }
    return q;
  }

  async runBeforeWrite(
    patches: PatchInput[],
    ctx: PatchesDbContext,
    tx: SqlClient
  ): Promise<PatchInput[]> {
    let p = patches;
    for (const fn of this.beforeWriteFns) {
      p = await fn(p, ctx, tx);
    }
    return p;
  }

  async runAfterWrite(
    written: Patch[],
    ctx: PatchesDbContext,
    tx: SqlClient
  ): Promise<void> {
    for (const fn of this.afterWriteFns) {
      await fn(written, ctx, tx);
    }
  }
}
