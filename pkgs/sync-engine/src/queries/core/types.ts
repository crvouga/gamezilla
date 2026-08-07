import type { Topic } from '@pkgs/pubsub/interface';
import type { Sql } from '@pkgs/sql';
import type { z } from 'zod';

import type { QueryChannelsCtx } from '../../shared/push-payload';

export type QueryRow = Record<string, unknown>;

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

type QueryChannels<P> = {
  bivarianceHack(params: P, ctx: QueryChannelsCtx): Topic[];
}['bivarianceHack'];

export type QueryDef<P> = {
  /** Stable wire contract; version by suffix (fooV2). */
  readonly name: string;
  readonly params: z.ZodType<P>;
  /** Local tables this query's rows land in. */
  readonly hydrates: readonly string[];
  /** Hard row limit — required; enforced at registry time. */
  readonly limit: number;
  /** Topics whose pushes affect this query's scope (optional; reconcile-only if omitted). */
  readonly channels?: QueryChannels<P>;
  readonly authorize?: QueryAuthorize<P>;
  readonly run: QueryRun<P>;
};

export type QueryRegistry = Readonly<Record<string, QueryDef<unknown>>>;

/**
 * Query wire responses. Snapshots are always full tables including soft-deleted
 * rows (`_deleted_at`); the client upserts them verbatim.
 */
export type QueryResponse =
  | {
      readonly status: 'ok';
      readonly checkpoint: string;
      readonly hash: string;
      readonly tables: Readonly<Record<string, readonly QueryRow[]>>;
    }
  | { readonly status: 'not_modified' }
  | { readonly status: 'denied' };

export type AuthErrorBody = {
  readonly error: 'auth';
  readonly reason: 'expired' | 'revoked';
};
