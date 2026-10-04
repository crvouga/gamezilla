import { assert } from '@pkgs/assert-shared/singleton';
import type { MessageTag } from '@pkgs/message-shared/message';

import type {
  OutboxConsumerCtx,
  OutboxConsumerDef,
  OutboxRetryPolicy,
} from './types';
import { DEFAULT_OUTBOX_RETRY_POLICY } from './types';

export function defineOutboxConsumer<P>(def: {
  readonly id: string;
  readonly on: MessageTag<P>;
  readonly retryPolicy?: OutboxRetryPolicy;
  readonly handler: (
    ctx: OutboxConsumerCtx,
    payload: P
  ) => Promise<void | { readonly notifyUserIds?: readonly string[] }>;
}): OutboxConsumerDef<P> {
  assert.ok(def.id.length > 0, 'outbox consumer id required');
  return {
    id: def.id,
    on: def.on,
    ...(def.retryPolicy !== undefined ? { retryPolicy: def.retryPolicy } : {}),
    handler: def.handler,
  };
}

export class OutboxConsumerRegistry {
  private readonly byId = new Map<string, OutboxConsumerDef>();
  private readonly byType = new Map<string, OutboxConsumerDef[]>();

  register<P>(consumer: OutboxConsumerDef<P>): void {
    assert.ok(
      !this.byId.has(consumer.id),
      `duplicate outbox consumer id: ${consumer.id}`
    );
    const erased = consumer as unknown as OutboxConsumerDef;
    this.byId.set(erased.id, erased);
    const list = this.byType.get(erased.on.type) ?? [];
    list.push(erased);
    this.byType.set(erased.on.type, list);
  }

  registerAll(consumers: ReadonlyArray<OutboxConsumerDef>): void {
    for (const c of consumers) this.register(c);
  }

  get(id: string): OutboxConsumerDef | undefined {
    return this.byId.get(id);
  }

  consumersForType(type: string): readonly OutboxConsumerDef[] {
    return this.byType.get(type) ?? [];
  }

  all(): readonly OutboxConsumerDef[] {
    return [...this.byId.values()];
  }

  messageTypes(): readonly string[] {
    return [...this.byType.keys()];
  }
}

export function resolveRetryPolicy(
  consumer: OutboxConsumerDef
): OutboxRetryPolicy {
  return consumer.retryPolicy ?? DEFAULT_OUTBOX_RETRY_POLICY;
}
