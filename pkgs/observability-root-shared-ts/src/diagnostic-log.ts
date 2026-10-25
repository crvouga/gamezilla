import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import { ATTR } from './attributes';
import { allowlistedAttributes } from './redaction';
import { reproductionAttributes } from './reproducible-error';

export type DiagnosticLog = {
  readonly severity: 'debug' | 'info' | 'warn' | 'error';
  readonly message: string;
  readonly loggerName: string;
  readonly context?: Readonly<Record<string, unknown>>;
};

/** Only approved scalar attributes and the exception reach diagnostic exporters. */
export function diagnosticAttributes(event: DiagnosticLog) {
  const values: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(event.context ?? {})) {
    if (
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    )
      values[key] = value;
  }
  const error = event.context?.['error'];
  return allowlistedAttributes({
    ...values,
    [ATTR.APP_LOG_SEVERITY]: event.severity,
    [ATTR.APP_LOG_MESSAGE]: event.message,
    [ATTR.APP_LOG_NAME]: event.loggerName,
    ...(error instanceof Error
      ? {
          [ATTR.EXCEPTION_TYPE]: error.name,
          [ATTR.EXCEPTION_MESSAGE]: error.message,
          [ATTR.EXCEPTION_STACKTRACE]: error.stack,
        }
      : typeof error === 'string'
        ? { [ATTR.EXCEPTION_MESSAGE]: error }
        : {}),
  });
}

/**
 * A warning or error without a request still needs a finished trace the
 * investigation CLI can find: it reads traces, not the log signal. Errors are
 * `runtime.error`; warnings are `runtime.warning`, searchable but not failures.
 */
export function recordDiagnosticSpan(event: DiagnosticLog): void {
  if (event.severity !== 'error' && event.severity !== 'warn') return;
  // Replay bytes belong to the trace: the independent log signal has a 512-character cap.
  const attributes = {
    ...diagnosticAttributes(event),
    ...reproductionAttributes(event.context?.['error']),
  };
  const span = trace
    .getTracer('@pkgs/observability')
    .startSpan(
      event.severity === 'error' ? 'runtime.error' : 'runtime.warning',
      { attributes },
      context.active()
    );
  if (event.severity === 'error') {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: String(
        attributes[ATTR.EXCEPTION_MESSAGE] ?? attributes[ATTR.APP_LOG_MESSAGE]
      ),
    });
    span.addEvent('exception', {
      [ATTR.EXCEPTION_TYPE]: attributes[ATTR.EXCEPTION_TYPE] ?? 'Error',
      [ATTR.EXCEPTION_MESSAGE]:
        attributes[ATTR.EXCEPTION_MESSAGE] ?? event.message,
      ...(attributes[ATTR.EXCEPTION_STACKTRACE] === undefined
        ? {}
        : {
            [ATTR.EXCEPTION_STACKTRACE]: attributes[ATTR.EXCEPTION_STACKTRACE],
          }),
    });
  }
  span.end();
}
