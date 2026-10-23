import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { MutationDb } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { ReplayAuth } from './replay-mutation';

export type MutationTxWrapper = (args: {
  readonly tx: MutationDb;
  readonly auth: ReplayAuth;
  readonly mutationId: string;
}) => MutationDb;

export type CommittedMutations = {
  readonly db: SqlClient;
  readonly auth: ReplayAuth;
  /** Includes already committed duplicate writes; excludes rejected writes. */
  readonly mutationIds: readonly string[];
};

export type CommittedMutationListener = (
  batch: CommittedMutations
) => Promise<void>;

export type MutationLifecycle = {
  /** Decorate the captured transaction before authorization and domain work. */
  readonly wrapMutationTx?: MutationTxWrapper;
  /** Awaited after commit and ordinary fanout, before acknowledging the request. */
  readonly onCommittedMutations?: CommittedMutationListener;
};
