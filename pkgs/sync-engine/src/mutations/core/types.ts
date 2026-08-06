import type { Topic } from '@pkgs/pubsub/interface';
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

type MutationInvalidates<A> = {
  bivarianceHack(
    args: A,
    env: MutationEnv,
    /** Post-commit read client for party expansion (optional). */
    db?: MutationDb
  ): readonly Topic[] | Promise<readonly Topic[]>;
}['bivarianceHack'];

export type Mutation<A> = {
  /** Stable wire contract; version by suffix (joinSpaceV2). */
  readonly name: string;
  readonly args: z.ZodType<A>;
  /** Documentation + lint/review target. NOT runtime-enforced. */
  readonly writes: readonly string[];
  /** Map DB constraint violations to business rejections during replay. */
  readonly constraintErrors?: Readonly<
    Record<string, { readonly code: string; readonly message: string }>
  >;
  /** UX knob consumed by feature UI: default 'instant'. */
  readonly pendingUx?: 'instant' | 'pending';
  /** If true, client runner refuses to initiate while offline. */
  readonly requiresOnline?: boolean;
  /** Topics to nudge after successful server replay (optional). */
  readonly invalidates?: MutationInvalidates<A>;
  readonly run: MutationRun<A>;
};

export type MutationRegistry = Readonly<Record<string, Mutation<unknown>>>;
