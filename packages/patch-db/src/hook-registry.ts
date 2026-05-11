import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { isPatchDbSystemContext } from './context';
import type {
  Patch,
  PatchDbBeforeWriteHookResult,
  PatchDbHooks,
  PatchDbQuery,
  PatchInput,
  PatchRejectionReason,
  Unsubscribe,
} from './interface';

type BeforeReadFn = (
  query: PatchDbQuery,
  ctx: Readonly<Record<string, unknown>>
) => PatchDbQuery | Promise<PatchDbQuery>;

type BeforeWriteFn = (
  patches: PatchInput[],
  ctx: Readonly<Record<string, unknown>>,
  tx: SqlClient
) => PatchDbBeforeWriteHookResult | Promise<PatchDbBeforeWriteHookResult>;

type AfterWriteFn = (
  written: Patch[],
  ctx: Readonly<Record<string, unknown>>,
  tx: SqlClient
) => void | Promise<void>;

type EnrichContextFn = (
  ctx: Readonly<Record<string, unknown>>
) =>
  | Readonly<Record<string, unknown>>
  | Promise<Readonly<Record<string, unknown>>>;

export function normalizeBeforeWriteHookResult(
  result: PatchDbBeforeWriteHookResult
): { accepted: PatchInput[]; rejected: PatchRejectionReason[] } {
  if (Array.isArray(result)) {
    return { accepted: result, rejected: [] };
  }
  return result;
}

/**
 * Composable hook lists; {@link PatchDbImplSqlite} / {@link PatchDbImplPostgres}
 * invoke these inside the read path and inside the write transaction.
 */
export class PatchDbHookRegistry implements PatchDbHooks {
  private enrichContextFns: EnrichContextFn[] = [];
  private beforeReadFns: BeforeReadFn[] = [];
  private beforeWriteFns: BeforeWriteFn[] = [];
  private afterWriteFns: AfterWriteFn[] = [];

  enrichContext(fn: EnrichContextFn): Unsubscribe {
    this.enrichContextFns.push(fn);
    return () => {
      const i = this.enrichContextFns.indexOf(fn);
      if (i >= 0) this.enrichContextFns.splice(i, 1);
    };
  }

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

  /**
   * Runs every registered enricher in registration order, threading each
   * one's output into the next. System contexts bypass enrichment entirely so
   * privileged callers (migrations, scripts, webhooks) never trigger the
   * (potentially DB-touching) enrichment pipeline.
   */
  async runEnrichContext(
    ctx: Readonly<Record<string, unknown>>
  ): Promise<Readonly<Record<string, unknown>>> {
    if (isPatchDbSystemContext(ctx)) return ctx;
    let c = ctx;
    for (const fn of this.enrichContextFns) {
      c = await fn(c);
    }
    return c;
  }

  async runBeforeRead(
    query: PatchDbQuery,
    ctx: Readonly<Record<string, unknown>>
  ): Promise<PatchDbQuery> {
    let q = query;
    for (const fn of this.beforeReadFns) {
      q = await fn(q, ctx);
    }
    return q;
  }

  async runBeforeWrite(
    patches: PatchInput[],
    ctx: Readonly<Record<string, unknown>>,
    tx: SqlClient
  ): Promise<{ accepted: PatchInput[]; rejected: PatchRejectionReason[] }> {
    let acc = patches;
    const mergedRejected: PatchRejectionReason[] = [];
    for (const fn of this.beforeWriteFns) {
      const out = normalizeBeforeWriteHookResult(await fn(acc, ctx, tx));
      mergedRejected.push(...out.rejected);
      acc = out.accepted;
    }
    return { accepted: acc, rejected: mergedRejected };
  }

  async runAfterWrite(
    written: Patch[],
    ctx: Readonly<Record<string, unknown>>,
    tx: SqlClient
  ): Promise<void> {
    for (const fn of this.afterWriteFns) {
      await fn(written, ctx, tx);
    }
  }
}
