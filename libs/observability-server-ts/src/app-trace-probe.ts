import { serviceName } from '@libs/product-identity-shared-ts/technical-names';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import { TempoTraceStore } from '@pkgs/observability-root-shared-ts/tempo';

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

/**
 * Ask the real app for something that needs its database, with a known
 * investigation id. The session route opens a connection before it decides
 * whether anyone is signed in (it answers 401 to a stranger, which is an
 * answer); `/api/health` never touches the database, so it cannot say how far
 * away the data is.
 */
export async function requestDatabaseTrace(
  http: HttpClient,
  apiOrigin: string,
  probe: AppTraceProbe
): Promise<boolean> {
  const response = await http.fetch(
    `${apiOrigin.replace(/\/$/, '')}/api/auth/session`,
    { headers: { traceparent: `00-${probe.traceId}-${probe.spanId}-01` } }
  );
  await response.body?.cancel();
  return response.status < 500;
}

export type AppTraceCredentials = {
  readonly probe: AppTraceProbe;
  readonly tempoUrl: string;
  readonly tempoUser: string;
  readonly tempoToken: string;
  readonly nowMs: number;
};

/**
 * How long the request took to reach its database (the connection and the
 * statements that pin its session), from the request's own trace; null while
 * the trace is not readable yet. It is the part of a request that grows with
 * the distance between the app and its data.
 */
export async function readDatabaseOpenMs(
  http: HttpClient,
  args: AppTraceCredentials
): Promise<number | null> {
  const store = new TempoTraceStore({
    baseUrl: args.tempoUrl.replace(/\/$/, ''),
    fetch: (input, init) => http.fetch(input, init),
    now: () => args.nowMs,
    username: args.tempoUser,
    token: args.tempoToken,
  });
  const trace = await store.getTrace(args.probe.traceId);
  if (trace === null || trace === undefined) return null;
  const spans = trace.spans.filter(
    (span) => span.traceId === args.probe.traceId
  );
  if (!spans.some((span) => span.name === 'worker.fetch')) return null;
  const open = spans.find((span) => span.name === 'db.open');
  return open === undefined ? null : open.durationMs;
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
        span.attributes[ATTR.SERVICE_NAME] === serviceName('server') &&
        span.attributes[ATTR.HTTP_RESPONSE_STATUS_CODE] === 200
    ) ?? false
  );
}
