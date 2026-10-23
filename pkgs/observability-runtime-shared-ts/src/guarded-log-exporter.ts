import type { Counter, Meter } from '@opentelemetry/api';
import type {
  LogRecordExporter,
  ReadableLogRecord,
} from '@opentelemetry/sdk-logs';
import type { EventContract } from '@pkgs/observability-root-shared-ts/event-contract';
import { validateEvent } from '@pkgs/observability-root-shared-ts/event-contract';
import { SCHEMA_VIOLATIONS_METRIC } from '@pkgs/observability-root-shared-ts/pipeline-metrics';
import { allowlistedAttributes } from '@pkgs/observability-root-shared-ts/redaction';

const ENVELOPE_KEYS = new Set([
  'event.id',
  'event.version',
  'event.delivery',
  'event.synthetic',
]);

/** The exporter guard also covers third-party log instrumentation. Bodies and
 * scope attributes are never exported; named events require registered schemas. */
export class GuardedLogExporter implements LogRecordExporter {
  readonly #violations: Counter | undefined;
  readonly #contracts: Map<string, EventContract>;
  readonly #exporter: LogRecordExporter;

  constructor(
    exporter: LogRecordExporter,
    contracts: readonly EventContract[],
    meter?: Meter
  ) {
    this.#exporter = exporter;
    this.#violations = meter?.createCounter(SCHEMA_VIOLATIONS_METRIC.name, {
      description: SCHEMA_VIOLATIONS_METRIC.description,
      unit: SCHEMA_VIOLATIONS_METRIC.unit,
    });
    this.#contracts = new Map(
      contracts.map((contract) => [contract.name, contract])
    );
    if (this.#contracts.size !== contracts.length)
      throw new Error('Duplicate event contracts');
  }

  export(
    records: ReadableLogRecord[],
    callback: Parameters<LogRecordExporter['export']>[1]
  ): void {
    const safe = records.flatMap((record) => {
      const attributes = this.safeAttributes(record);
      if (attributes === undefined) return [];
      return [
        {
          hrTime: record.hrTime,
          hrTimeObserved: record.hrTimeObserved,
          resource: record.resource,
          droppedAttributesCount: record.droppedAttributesCount,
          ...(record.spanContext === undefined
            ? {}
            : { spanContext: record.spanContext }),
          ...(record.eventName === undefined
            ? {}
            : { eventName: record.eventName }),
          ...(record.severityNumber === undefined
            ? {}
            : { severityNumber: record.severityNumber }),
          ...(record.severityText === undefined
            ? {}
            : { severityText: record.severityText }),
          attributes,
          body:
            record.eventName ??
            String(attributes['app.log.name'] ?? 'diagnostic'),
          instrumentationScope: { name: '@pkgs/observability' },
        },
      ];
    });
    if (records.length > safe.length)
      this.#violations?.add(records.length - safe.length);
    if (safe.length === 0) callback({ code: 0 });
    else this.#exporter.export(safe, callback);
  }

  private safeAttributes(record: ReadableLogRecord) {
    if (record.eventName === undefined)
      return allowlistedAttributes(record.attributes as never);
    const contract = this.#contracts.get(record.eventName);
    if (contract === undefined) return undefined;
    const payload = Object.fromEntries(
      Object.entries(record.attributes).filter(
        ([key]) => !ENVELOPE_KEYS.has(key)
      )
    );
    const id = record.attributes['event.id'];
    if (
      !validateEvent(contract, payload) ||
      typeof id !== 'string' ||
      id.length === 0 ||
      id.length > 256 ||
      /\s|@/.test(id) ||
      record.attributes['event.version'] !== contract.version ||
      record.attributes['event.delivery'] !== contract.delivery ||
      (record.attributes['event.synthetic'] !== undefined &&
        typeof record.attributes['event.synthetic'] !== 'boolean')
    )
      return undefined;
    return record.attributes;
  }

  forceFlush(): Promise<void> {
    return this.#exporter.forceFlush();
  }
  shutdown(): Promise<void> {
    return this.#exporter.shutdown();
  }
}
