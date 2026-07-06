import { createLogger, type Logger } from '@pkgs/logger/logger';

import { BaseObservability } from '../port/base-observability';
import { InMemorySpanContextStorage } from '../port/in-memory-context-storage';
import type { Observability, SpanContextStorage } from '../port/observability';
import { isSlowSpan } from '../shared/slow-thresholds';
import type { ExportedSpanRecord } from '../shared/types';

export type LoggerObservabilityOptions = {
  readonly serviceName: string;
  readonly logger?: Logger;
  readonly storage?: SpanContextStorage;
};

function spanLogContext(record: ExportedSpanRecord): Record<string, unknown> {
  return {
    span: record.name,
    traceId: record.traceId,
    spanId: record.spanId,
    ...(record.parentSpanId !== undefined
      ? { parentSpanId: record.parentSpanId }
      : {}),
    durationMs: record.durationMs,
    kind: record.kind,
    status: record.status,
    ...(record.statusMessage !== undefined
      ? { statusMessage: record.statusMessage }
      : {}),
    ...(Object.keys(record.attributes).length > 0
      ? { attributes: record.attributes }
      : {}),
    ...(record.events.length > 0 ? { events: record.events } : {}),
  };
}

export function exportSpanToLogger(
  record: ExportedSpanRecord,
  logger: Logger
): void {
  const context = spanLogContext(record);
  if (record.status === 'error') {
    logger.error('span ended', context);
    return;
  }
  if (isSlowSpan(record.name, record.durationMs)) {
    logger.warn('slow span', context);
    return;
  }
  logger.debug('span ended', context);
}

export function createLoggerObservability(
  options: LoggerObservabilityOptions
): Observability {
  const logger =
    options.logger ?? createLogger({ name: options.serviceName, level: 'info' });
  const storage = options.storage ?? new InMemorySpanContextStorage();

  return new BaseObservability({
    serviceName: options.serviceName,
    backend: 'logger',
    storage,
    exporter: (record) => exportSpanToLogger(record, logger),
  });
}

export function createLoggerObservabilityWithExporter(args: {
  readonly serviceName: string;
  readonly exporter: (record: ExportedSpanRecord) => void;
  readonly storage?: SpanContextStorage;
}): Observability {
  return new BaseObservability({
    serviceName: args.serviceName,
    backend: 'logger',
    storage: args.storage ?? new InMemorySpanContextStorage(),
    exporter: args.exporter,
  });
}
