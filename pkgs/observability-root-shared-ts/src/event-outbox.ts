import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared-ts/message';
import { Outbox } from '@pkgs/outbox-shared-ts/outbox';
import type { OutboxSendCtx } from '@pkgs/outbox-shared-ts/types';
import type { EventEnvelope } from './business-event';
import { serializeTraceContext } from './correlation';
import type { EventContract, EventPayload } from './event-contract';
import { validateEvent } from './event-contract';

export type PendingTelemetryEvent = {
  readonly envelope: EventEnvelope;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly traceparent?: string;
};

/** Each domain creates a tag from its own contract. The existing transactional
 * outbox owns retries and durable identity; no parallel event queue is needed. */
export function createEventOutbox<C extends EventContract>(contract: C) {
  const message = createMessageNamespace('telemetry', contract.owner)(
    `${contract.name.replaceAll('.', '-')}-v${contract.version}`,
    (value): value is PendingTelemetryEvent => validPending(contract, value)
  );
  return {
    message,
    async enqueue(
      ctx: OutboxSendCtx,
      input: {
        readonly attributes: EventPayload<C>;
        readonly envelope: EventEnvelope;
        readonly traceparent?: string;
      }
    ): Promise<void> {
      const traceparent = input.traceparent ?? serializeTraceContext();
      await new Outbox(ctx).send({
        id: `telemetry:${contract.name}:v${contract.version}:${input.envelope.id}`,
        message: message({
          ...input,
          ...(traceparent === undefined ? {} : { traceparent }),
        }),
      });
    },
  };
}

function validPending(
  contract: EventContract,
  value: unknown
): value is PendingTelemetryEvent {
  if (
    !isPlainRecord(value) ||
    !isPlainRecord(value['attributes']) ||
    !isPlainRecord(value['envelope'])
  )
    return false;
  const envelope = value['envelope'];
  return (
    validateEvent(contract, value['attributes']) &&
    typeof envelope['id'] === 'string' &&
    envelope['id'].length > 0 &&
    envelope['id'].length <= 256 &&
    !/\s|@/.test(envelope['id']) &&
    typeof envelope['occurredAtMs'] === 'number' &&
    Number.isSafeInteger(envelope['occurredAtMs']) &&
    envelope['occurredAtMs'] >= 0 &&
    (envelope['synthetic'] === undefined ||
      typeof envelope['synthetic'] === 'boolean') &&
    (value['traceparent'] === undefined ||
      (typeof value['traceparent'] === 'string' &&
        /^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/.test(value['traceparent'])))
  );
}
