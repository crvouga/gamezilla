import type { HttpClient } from '@pkgs/http-client-shared/types';
import { ATTR } from '@pkgs/observability-root-shared/attributes';
import { TempoTraceStore } from '@pkgs/observability-root-shared/tempo';

export type AppTraceProbe = {
  readonly traceId: string;
  readonly spanId: string;
};

/** Ask the real app to handle a harmless request with a known investigation id. */
export async function requestAppTrace(
  http: HttpClient,
  apiOrigin: string,
  probe: AppTraceProbe
): Promise<boolean> {
  const response = await http.fetch(
    `${apiOrigin.replace(/\/$/, '')}/api/health`,
    {
      headers: { traceparent: `00-${probe.traceId}-${probe.spanId}-01` },
    }
  );
  return response.ok;
}

/** An empty accepted batch or a working query token is insufficient evidence. */
export async function appTraceIsReadable(
  http: HttpClient,
  args: {
    readonly probe: AppTraceProbe;
    readonly tempoUrl: string;
    readonly tempoUser: string;
    readonly tempoToken: string;
    readonly nowMs: number;
  }
): Promise<boolean> {
  const store = new TempoTraceStore({
    baseUrl: args.tempoUrl.replace(/\/$/, ''),
    fetch: (input, init) => http.fetch(input, init),
    now: () => args.nowMs,
    username: args.tempoUser,
    token: args.tempoToken,
  });
  const trace = await store.getTrace(args.probe.traceId);
  return (
    trace?.spans.some(
      (span) =>
        span.traceId === args.probe.traceId &&
        span.name === 'worker.fetch' &&
        span.attributes[ATTR.SERVICE_NAME] === 'gamezilla-server' &&
        span.attributes[ATTR.HTTP_RESPONSE_STATUS_CODE] === 200
    ) ?? false
  );
}
