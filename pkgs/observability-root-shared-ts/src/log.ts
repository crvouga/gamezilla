import { context } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { ATTR } from './attributes';
import type { DiagnosticLog } from './diagnostic-log';
import { diagnosticAttributes, recordDiagnosticSpan } from './diagnostic-log';
import { addEvent, EVENT } from './events';
import { allowlistedAttributes } from './redaction';
import { activeSpan } from './span';

export type LogSeverity = 'debug' | 'info' | 'warn' | 'error';

export type CorrelatedLogEvent = DiagnosticLog;

const LOG_EVENT_BRIDGE = Symbol.for('@pkgs/observability.log-event');
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
  recordLogEvent(event);
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
      attributes: diagnosticAttributes(event),
    });
  } catch {
    // Logging must not fail a product operation.
  }
}

export function recordStructuredError(
  error: Error,
  loggerName: string,
  source = context.active()
): void {
  try {
    logs.getLogger('@pkgs/observability').emit({
      context: source,
      severityNumber: SeverityNumber.ERROR,
      severityText: 'ERROR',
      attributes: allowlistedAttributes({
        [ATTR.APP_LOG_NAME]: loggerName,
        [ATTR.EXCEPTION_TYPE]: error.name,
        [ATTR.EXCEPTION_MESSAGE]: error.message,
        [ATTR.EXCEPTION_STACKTRACE]: error.stack,
      }),
    });
  } catch {
    /* Diagnostic failures must not interrupt recovery. */
  }
}

/** Records a log on the active span. Startup/no-context calls are no-ops. */
export function recordLogEvent(event: CorrelatedLogEvent): void {
  recordDiagnosticSpan(event);
  const span = activeSpan();
  if (span === undefined) return;
  const attributes = diagnosticAttributes(event);
  addEvent(span, EVENT.LOG_EMITTED, {
    ...attributes,
    [ATTR.APP_LOG_SEVERITY]: event.severity,
    [ATTR.APP_LOG_MESSAGE]: String(attributes[ATTR.APP_LOG_MESSAGE] ?? ''),
    [ATTR.APP_LOG_NAME]: String(attributes[ATTR.APP_LOG_NAME] ?? ''),
  });
}
