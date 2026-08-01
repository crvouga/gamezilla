import type { SqlClient } from '@pkgs/sql-client/interface';
import type { UploadBatch } from '@pkgs/sync-engine/shared/upload-batch';

export type Phase = 'before' | 'after';

export type Failure = {
  readonly code: string;
  readonly table?: string;
  readonly id?: string;
  readonly params?: Readonly<Record<string, unknown>>;
};

export type RulesAuth = {
  readonly subjectId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
  /** Author id: accountId ?? deviceId */
  readonly myId: string;
  readonly isAnonymous: boolean;
  readonly memberOfSpaceIds: readonly string[];
};

export type RulesCtx = {
  readonly phase: Phase;
  readonly auth: RulesAuth;
  readonly batch: UploadBatch;
  readonly db: Pick<SqlClient, 'query'>;
};

export type Rule = {
  readonly name: string;
  readonly phase: Phase;
  readonly touches: readonly string[];
  readonly check: (ctx: RulesCtx) => Promise<readonly Failure[]>;
};
