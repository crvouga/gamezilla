import { defaultTextMapGetter, ROOT_CONTEXT } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  LoggerProvider,
  type LogRecordExporter,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import type { MessageTag } from '@pkgs/message-shared/message';
import { ATTR } from '@pkgs/observability-root-shared/attributes';
import type { EventContract } from '@pkgs/observability-root-shared/event-contract';
import { validateEvent } from '@pkgs/observability-root-shared/event-contract';
import type { PendingTelemetryEvent } from '@pkgs/observability-root-shared/event-outbox';
import { allowlistedAttributes } from '@pkgs/observability-root-shared/redaction';
import type { TelemetryOptions } from '@pkgs/observability-runtime-shared/options';
import { defineOutboxConsumer } from '@pkgs/outbox-shared/define-consumer';

export function createBusinessEventDelivery(options: TelemetryOptions) {
  const exporter =
    options.logExporter ??
    (options.logsUrl === undefined
      ? undefined
      : new OTLPLogExporter({
          url: options.logsUrl,
          timeoutMillis: 5000,
          ...(options.otlpHeaders === undefined
            ? {}
            : { headers: options.otlpHeaders }),
        }));
  if (exporter === undefined) return undefined;
  return (input: {
    readonly contract: EventContract;
    readonly event: PendingTelemetryEvent;
    readonly observedAtMs: number;
  }) =>
    exportAcknowledged(
      {
        contract: input.contract,
        exporter,
        resourceAttributes: {
          [ATTR.SERVICE_NAME]: options.serviceName,
          [ATTR.SERVICE_VERSION]: options.serviceVersion,
          [ATTR.DEPLOYMENT_ENVIRONMENT_NAME]: options.environment,
          [ATTR.APP_BUILD_SHA]: options.buildSha,
        },
      },
      input.event,
      input.observedAtMs
    );
}

/** An acknowledged export fails the delivery, not the already committed domain
 * operation. A lost acknowledgement can redeliver; analytics deduplicate event.id. */
export function createEventDelivery(input: {
  readonly contract: EventContract;
  readonly message: MessageTag<PendingTelemetryEvent>;
  readonly exporter: LogRecordExporter;
  readonly resourceAttributes: Readonly<Record<string, string>>;
}) {
  return defineOutboxConsumer({
    id: `telemetry:${input.contract.name}:v${input.contract.version}`,
    on: input.message,
    async handler(ctx, pending) {
      if (
        !input.message.validatePayload(pending) ||
        !validateEvent(input.contract, pending.attributes)
      )
        throw new Error('Telemetry contract violation');
      await exportAcknowledged(input, pending, ctx.clock.now());
    },
  });
}

export async function exportAcknowledged(
  input: Omit<Parameters<typeof createEventDelivery>[0], 'message'>,
  pending: PendingTelemetryEvent,
  observedAtMs: number
): Promise<void> {
  let resolveExport!: () => void;
  let rejectExport!: (error: Error) => void;
  const acknowledged = new Promise<void>((resolve, reject) => {
    resolveExport = resolve;
    rejectExport = reject;
  });
  const provider = new LoggerProvider({
    resource: resourceFromAttributes(
      allowlistedAttributes(input.resourceAttributes)
    ),
    processors: [
      new SimpleLogRecordProcessor({
        exporter: {
          export(records, done) {
            try {
              input.exporter.export(records, (result) => {
                done(result);
                if (result.code === 0) resolveExport();
                else rejectExport(new Error('Telemetry export failed'));
              });
            } catch {
              done({ code: 1 });
              rejectExport(new Error('Telemetry export failed'));
            }
          },
          forceFlush: () => input.exporter.forceFlush(),
          shutdown: () => Promise.resolve(),
        },
      }),
    ],
  });
  provider
    .getLogger(input.contract.owner)
    .emit(eventRecord(input.contract, pending, observedAtMs));
  try {
    await acknowledged;
  } finally {
    await provider.shutdown();
  }
}

function eventRecord(
  contract: EventContract,
  pending: PendingTelemetryEvent,
  observedAtMs: number
) {
  const time = (ms: number): [number, number] => [
    Math.floor(ms / 1000),
    (ms % 1000) * 1_000_000,
  ];
  return {
    eventName: contract.name,
    severityNumber: SeverityNumber.INFO,
    timestamp: time(pending.envelope.occurredAtMs),
    observedTimestamp: time(observedAtMs),
    context:
      pending.traceparent === undefined
        ? ROOT_CONTEXT
        : new W3CTraceContextPropagator().extract(
            ROOT_CONTEXT,
            { traceparent: pending.traceparent },
            defaultTextMapGetter
          ),
    attributes: {
      ...pending.attributes,
      'event.id': pending.envelope.id,
      'event.version': contract.version,
      'event.delivery': contract.delivery,
      ...(pending.envelope.synthetic === undefined
        ? {}
        : { 'event.synthetic': pending.envelope.synthetic }),
    },
  };
}
