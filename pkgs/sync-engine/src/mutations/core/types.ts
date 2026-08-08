import type { SqlClient } from '@pkgs/sql-client/interface';
import type { z } from 'zod';

/** What a mutation body sees: the transaction-scoped SqlClient, reads + writes. */
export type MutationDb = Pick<SqlClient, 'query' | 'run'>;

export type MutationEnv = {
  readonly actorId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly isAnon: boolean;
  /** Replay pins this to the mutation's created_at. */
  readonly now: () => Date;
  /** Server wall clock; present only on replay (staleness checks). */
  readonly serverNow?: () => Date;
};

export type MutationCtx = {
  readonly tx: MutationDb;
  readonly env: MutationEnv;
};

export class MutationError extends Error {
  readonly code: string;
  readonly meta: Record<string, unknown> | undefined;

  constructor(code: string, message: string, meta?: Record<string, unknown>) {
    super(message);
    this.name = 'MutationError';
    this.code = code;
    this.meta = meta;
  }
}

export type MutationFailure = {
  readonly rule: string;
  readonly code: string;
  readonly message: string;
  readonly meta?: Record<string, unknown>;
};

export type MutateResult =
  | { readonly ok: true; readonly mutationId: string }
  | { readonly ok: false; readonly failures: readonly MutationFailure[] };

type MutationRun<A> = {
  bivarianceHack(ctx: MutationCtx, args: A): Promise<void>;
}['bivarianceHack'];

/**
 * Domain mutation. Write sets, fanout ids, and invalidation topics are derived
 * from SQL AST capture + the host topic map — not declared on the def.
 */
export type Mutation<A> = {
  /** Stable wire contract. */
  readonly name: string;
  readonly args: z.ZodType<A>;
  /** Map DB constraint violations to business rejections during replay. */
  readonly constraintErrors?: Readonly<
    Record<string, { readonly code: string; readonly message: string }>
  >;
  /** UX knob consumed by feature UI: default 'instant'. */
  readonly pendingUx?: 'instant' | 'pending';
  /** If true, client runner refuses to initiate while offline. */
  readonly requiresOnline?: boolean;
  readonly run: MutationRun<A>;
};

export type MutationRegistry = Readonly<Record<string, Mutation<unknown>>>;
