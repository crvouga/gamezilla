import { ATTR } from './attributes';
import { diagnosticAttributes } from './diagnostic-log';

/** A supervisor can persist this before exiting, without a live SDK or collector. */
export function processFailureDocument(args: {
  readonly serviceName: string;
  readonly instanceId: string;
  readonly error: Error;
  readonly nowMs: number;
  readonly createId: () => string;
  readonly pid?: number;
  readonly exitCode?: number;
  readonly signal?: string;
}) {
  const time = String(Math.trunc(args.nowMs * 1_000_000));
  const attributes = diagnosticAttributes({
    severity: 'error',
    message: 'process failed',
    loggerName: args.serviceName,
    context: {
      error: args.error,
      [ATTR.PROCESS_PID]: args.pid,
      [ATTR.PROCESS_EXIT_CODE]: args.exitCode,
      [ATTR.PROCESS_EXIT_SIGNAL]: args.signal,
    },
  });
  const entries = Object.entries(attributes).map(([key, value]) => ({
    key,
    value:
      typeof value === 'number'
        ? { doubleValue: value }
        : typeof value === 'boolean'
          ? { boolValue: value }
          : { stringValue: String(value) },
  }));
  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            {
              key: ATTR.SERVICE_NAME,
              value: { stringValue: args.serviceName },
            },
            {
              key: ATTR.SERVICE_INSTANCE_ID,
              value: { stringValue: args.instanceId },
            },
            {
              key: ATTR.DEPLOYMENT_ENVIRONMENT_NAME,
              value: { stringValue: 'local' },
            },
          ],
        },
        scopeSpans: [
          {
            scope: { name: '@pkgs/observability' },
            spans: [
              {
                traceId: args.createId().replaceAll('-', ''),
                spanId: args.createId().replaceAll('-', '').slice(0, 16),
                name: 'process.failure',
                startTimeUnixNano: time,
                endTimeUnixNano: time,
                status: {
                  code: 2,
                  message: attributes[ATTR.EXCEPTION_MESSAGE],
                },
                attributes: entries,
                events: [
                  {
                    name: 'exception',
                    timeUnixNano: time,
                    attributes: entries.filter((entry) =>
                      entry.key.startsWith('exception.')
                    ),
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}
