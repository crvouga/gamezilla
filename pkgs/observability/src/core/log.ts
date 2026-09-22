import { ATTR } from './attributes';
import { addEvent, EVENT } from './events';
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
