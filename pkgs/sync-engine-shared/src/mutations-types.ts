import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import type { StandardSchemaV1 } from '@standard-schema/spec';

/** What a mutation body sees: the transaction-scoped SqlClient, reads + writes. */
export type MutationDb = Pick<SqlClient, 'query' | 'run'>;

export type MutationEnv = {
  /** Host-verified provenance; absent means unknown. Never read from mutation args. */
  readonly synthetic?: boolean;
  readonly actorId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly isAnon: boolean;
  /** Replay pins this to the mutation's created_at. */
  readonly now: () => Date;
  /** Id mint for managed `id` (and any mutation-local ids). */
  readonly createId: () => string;
  /** Server wall clock; present only on replay (staleness checks). */
  readonly serverNow?: () => Date;
  /** Authentication evidence supplied by the host, never mutation args. */
  readonly authenticatedAtMs?: number;
  /**
   * The app's content rules as this write meets them, supplied by the host
   * that runs product mutations: the device's rules on the optimistic apply,
   * and on replay the rules at the mutation's chosen contentRulesTime. A body
   * that judges text (a name, a title) reads them through its app's helper,
   * which fails loudly when a host left them out.
   */
  readonly contentRules?: ContentRules;
};

/** Whether the app's rules let `text` be saved as content of `kind`. */
export type ContentRules = {
  checkWrite(kind: string, text: string): { readonly allowed: boolean };
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
  /** Standard Schema (Zod/Valibot/…). Output is `A` for typed `run` args. */
  readonly args: StandardSchemaV1<unknown, A>;
  /** Map DB constraint violations to business rejections during replay. */
  readonly constraintErrors?: Readonly<
    Record<string, { readonly code: string; readonly message: string }>
  >;
  /**
   * `'instant'` (default): `mutate()` resolves on the local apply.
   * `'pending'`: it resolves on the server's verdict, so a rule only the
   * server can check (uniqueness across users) fails the call itself.
   * `'local'`: it resolves on local acceptance, but keeps the choice private
   * until the server decides it. Observe durable mutation feedback for refusal.
   */
  readonly pendingUx?: 'instant' | 'local' | 'pending';
  /** Replay uses the write's rules by default; 'replayed' uses current rules. */
  readonly contentRulesTime?: 'created' | 'replayed';
  /** If true, client runner refuses to initiate while offline. */
  readonly requiresOnline?: boolean;
  readonly run: MutationRun<A>;
};

export type MutationRegistry = Readonly<Record<string, Mutation<unknown>>>;

/** What a host-level server authorize hook sees for one replayed mutation. */
export type MutationAuthorizeCtx = {
  readonly name: string;
  /** Schema-validated args (the `run` input). */
  readonly args: unknown;
  /** Replay transaction (reads + writes; same capture as `run`). */
  readonly tx: MutationDb;
  readonly env: MutationEnv;
  /**
   * The host's authoritative clock (`env.now` is pinned to the client's
   * timestamp on replay). Guards that must not trust device time use this.
   */
  readonly serverNow: () => Date;
};

/**
 * Server-only guard run inside the replay transaction before `run`. Throw a
 * `MutationError` to reject permanently (recorded as a write rejection; the
 * client's optimistic rows roll back); any other error is retryable infra.
 */
export type MutationAuthorize = (ctx: MutationAuthorizeCtx) => Promise<void>;
