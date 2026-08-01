import type { SqlClient } from '@pkgs/sql-client/interface';
import type { UploadBatch } from '@pkgs/sync-engine/shared/upload-batch';

export type Phase = 'before' | 'after';

export type Failure = {
  readonly code: string;
  readonly table?: string;
  readonly id?: string;
  readonly params?: Readonly<Record<string, unknown>>;
};

/** App-agnostic auth for the rules engine. Domains may extend via generics. */
export type RulesAuth = {
  readonly userId: string;
};

export type RulesCtx<TAuth extends RulesAuth = RulesAuth> = {
  readonly phase: Phase;
  readonly auth: TAuth;
  readonly batch: UploadBatch;
  readonly db: Pick<SqlClient, 'query'>;
};

export type Rule<TAuth extends RulesAuth = RulesAuth> = {
  readonly name: string;
  readonly phase: Phase;
  readonly touches: readonly string[];
  readonly check: (ctx: RulesCtx<TAuth>) => Promise<readonly Failure[]>;
};
