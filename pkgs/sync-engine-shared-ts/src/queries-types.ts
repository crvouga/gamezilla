import type { Topic } from '@pkgs/pubsub-root-shared-ts/topic';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { QueryChannelsCtx } from './push-payload';
import type { QueryRow } from './v2';

/** Package default hard row budget when `limit` is omitted on a query. */
export const DEFAULT_QUERY_LIMIT = 2000;

export type QueryCtx = {
  readonly db: {
    readonly query: (query: Sql<unknown>) => Promise<QueryRow[]>;
  };
  readonly env: {
    readonly actorId: string;
    readonly deviceId: string;
    readonly accountId: string | null;
    readonly isAnon: boolean;
    readonly now: () => Date;
    readonly authenticatedAtMs?: number;
  };
};

type QueryAuthorize<P> = {
  bivarianceHack(ctx: QueryCtx, params: P): Promise<boolean>;
}['bivarianceHack'];

type QueryRun<P> = {
  bivarianceHack(
    ctx: QueryCtx,
    params: P
  ): Promise<Readonly<Record<string, readonly QueryRow[]>>>;
}['bivarianceHack'];

type QueryEntryChannel<P> = {
  bivarianceHack(params: P, ctx: QueryChannelsCtx): Topic[];
}['bivarianceHack'];

/**
 * Named snapshot query. `hydrates` is derived from `run` return keys (runtime).
 * Wake topics = topic-map(held live rows) ∪ entryChannel (host default).
 */
export type QueryDef<P = unknown> = {
  /** Stable wire contract. */
  readonly name: string;
  readonly run: QueryRun<P>;
  /**
   * Hard row budget. Omit to use {@link DEFAULT_QUERY_LIMIT}.
   * Explicit only for real budget decisions (not cardinality assertions).
   * After {@link defineQuery}, always a positive number.
   */
  readonly limit?: number;
  /**
   * True when `limit` was filled from {@link DEFAULT_QUERY_LIMIT}.
   * Strict harness/dev clipping only throws for default budgets (explicit
   * truncate tests keep silent clip).
   */
  readonly limitIsDefault?: boolean;
  /** Wire params; defaults to empty object schema at registry time. */
  readonly params?: StandardSchemaV1<unknown, P>;
  /**
   * Sample params for hydrate / workload / topic boot checks when `{}` fails
   * the params schema. Prefer shape-valid placeholders (no product stubs).
   */
  readonly sampleParams?: P;
  /** Real authz only — default deny-anon when omitted. */
  readonly authorize?: QueryAuthorize<P>;
  /** Opt out of default signed-in requirement. */
  readonly allowAnon?: boolean;
  /**
   * Entry wakes for rows not yet in scope. Omit → host `defaultEntryChannel`.
   * `false` = reconcile-only (no entry topic).
   */
  readonly entryChannel?: QueryEntryChannel<P> | false;
  /**
   * Tables this query hydrates — **runtime-derived** from `run` return keys
   * (filled on first execution). Not an authoring field.
   */
  readonly hydrates: readonly string[];
};

/** Authoring input to {@link defineQuery} — no runtime-derived fields. */
export type QueryDefInput<P = unknown> = Omit<
  QueryDef<P>,
  'hydrates' | 'limitIsDefault'
> & {
  readonly run: QueryRun<P>;
};

export type QueryRegistry = Readonly<Record<string, QueryDef<unknown>>>;
