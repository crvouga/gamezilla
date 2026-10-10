import { context } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { ATTR } from './attributes';
import { addEvent, EVENT } from './events';
import { allowlistedAttributes } from './redaction';
import { activeSpan } from './span';

export type LogSeverity = 'debug' | 'info' | 'warn' | 'error';

export type CorrelatedLogEvent = {
  readonly severity: LogSeverity;
  readonly message: string;
  readonly loggerName: string;
};

const LOG_EVENT_BRIDGE = Symbol.for('gamezilla.observability.log-event');
type LogBridgeHost = {
  [LOG_EVENT_BRIDGE]?: (event: CorrelatedLogEvent) => void;
};

/** Registers the OTel log-event sink without coupling the logger package to OTel. */
export function installLogEventBridge(): void {
  (globalThis as LogBridgeHost)[LOG_EVENT_BRIDGE] = recordLogEvent;
}

/** Replaces the span-event bridge when an independent log pipeline is present. */
export function installStructuredLogBridge(): void {
  (globalThis as LogBridgeHost)[LOG_EVENT_BRIDGE] = recordStructuredLog;
}

export function recordStructuredLog(event: CorrelatedLogEvent): void {
  const severity = {
    debug: SeverityNumber.DEBUG,
    info: SeverityNumber.INFO,
    warn: SeverityNumber.WARN,
    error: SeverityNumber.ERROR,
  };
  try {
    logs.getLogger('@pkgs/observability').emit({
      context: context.active(),
      severityNumber: severity[event.severity],
      severityText: event.severity.toUpperCase(),
      attributes: allowlistedAttributes({
        [ATTR.APP_LOG_MESSAGE]: event.message,
        [ATTR.APP_LOG_NAME]: event.loggerName,
      }),
    });
  } catch {
    // Logging must not fail a product operation.
  }
}

/** Records a log on the active span. Startup/no-context calls are no-ops. */
export function recordLogEvent(event: CorrelatedLogEvent): void {
  const span = activeSpan();
  if (span === undefined) return;
  addEvent(span, EVENT.LOG_EMITTED, {
    [ATTR.APP_LOG_SEVERITY]: event.severity,
    [ATTR.APP_LOG_MESSAGE]: event.message,
    [ATTR.APP_LOG_NAME]: event.loggerName,
  });
}
