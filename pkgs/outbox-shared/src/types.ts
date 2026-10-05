import type { Clock } from '@pkgs/clock-shared/types';
import type { Message, MessageTag } from '@pkgs/message-shared/message';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import type { CreateId } from '@pkgs/uuid-shared/create-id';

/** Minimal mutation-shaped context for isomorphic Outbox.send. */
export type OutboxSendCtx = {
  readonly tx: SqlTx;
  readonly env: {
    readonly now: () => Date;
    readonly createId: () => string;
  };
};

export type OutboxConsumerCtx = {
  readonly tx: SqlTx;
  readonly clock: Clock;
  readonly createId: CreateId;
  readonly objectStore?: ObjectStore;
};

export type OutboxRetryPolicy = {
  readonly maxAttempts: number;
  /** Delay before attempt n (1-based after failure). Last value repeats. */
  readonly backoffMs: readonly number[];
};

export const DEFAULT_OUTBOX_RETRY_POLICY: OutboxRetryPolicy = {
  maxAttempts: 8,
  backoffMs: [1_000, 5_000, 15_000, 60_000, 300_000],
};

export type OutboxConsumerDef<P = unknown> = {
  readonly id: string;
  readonly on: MessageTag<P>;
  readonly retryPolicy?: OutboxRetryPolicy;
  readonly handler: (
    ctx: OutboxConsumerCtx,
    payload: P
  ) => Promise<void | { readonly notifyUserIds?: readonly string[] }>;
};

export type OutboxSendInput = {
  readonly id: string;
  readonly message: Message;
  /** Deliver no earlier than this; default now. */
  readonly availableAt?: Date;
};
