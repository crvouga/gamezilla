import { context } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import type { EventContract, EventPayload } from './event-contract';
import { validateEvent } from './event-contract';

export type EventEnvelope = {
  readonly id: string;
  readonly occurredAtMs: number;
  /** Missing provenance is excluded from business analytics. */
  readonly synthetic?: boolean;
};

/** Named log records are independent of trace sampling. Delivery is best effort;
 * reliable callers must persist the envelope transactionally and retry export. */
export function emitBusinessEvent<C extends EventContract>(
  contract: C,
  payload: EventPayload<C>,
  envelope: EventEnvelope
): boolean {
  if (!validateEvent(contract, payload) || !validEnvelope(envelope))
    return false;
  try {
    logs.getLogger(contract.owner).emit({
      eventName: contract.name,
      timestamp: [
        Math.floor(envelope.occurredAtMs / 1000),
        (envelope.occurredAtMs % 1000) * 1_000_000,
      ],
      context: context.active(),
      severityNumber: SeverityNumber.INFO,
      attributes: {
        ...payload,
        'event.id': envelope.id,
        'event.version': contract.version,
        'event.delivery': contract.delivery,
        ...(envelope.synthetic === undefined
          ? {}
          : { 'event.synthetic': envelope.synthetic }),
      },
    });
    return true;
  } catch {
    // A diagnostic SDK failure must never fail the business transaction.
    return false;
  }
}

function validEnvelope(envelope: EventEnvelope): boolean {
  return (
    envelope.id.length > 0 &&
    envelope.id.length <= 256 &&
    !/\s|@/.test(envelope.id) &&
    Number.isSafeInteger(envelope.occurredAtMs) &&
    envelope.occurredAtMs >= 0 &&
    (envelope.synthetic === undefined ||
      typeof envelope.synthetic === 'boolean')
  );
}
