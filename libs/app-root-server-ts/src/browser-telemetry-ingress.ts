import type { ServerEnv } from '@libs/app-root-shared-ts/server-env';
import { resolveWebClientOrigin } from '@libs/app-root-shared-ts/web-client-origin';
import type { ApiHonoEnv } from '@libs/auth-shared-ts/api-hono-env';
import type { AuthContext } from '@libs/auth-shared-ts/types';
import { serviceName } from '@libs/product-identity-shared-ts/technical-names';
import {
  sanitizeBrowserOtlp,
  stampBrowserTraceResource,
} from '@pkgs/observability-root-shared-ts/browser-otlp';
import { otlpAuthorization } from '@pkgs/observability-root-shared-ts/otlp-auth';
import type { Context, Hono } from 'hono';

const BROWSER_SERVICE_NAME = serviceName('client');

type IngressContext = Context<ApiHonoEnv<AuthContext>>;

/**
 * The largest body the shipped browser client sends: a log batch holds at most
 * 256 records of 32 attributes of 512 characters (the SDK limits), about 4 MiB
 * before the envelope. The client drops a batch this relay refuses with 413
 * rather than resending it, so the cap never wedges its queue.
 */
const MAX_BROWSER_TELEMETRY_BYTES = 5 * 1024 * 1024;
type Signal = 'traces' | 'logs' | 'metrics';
export type BrowserTelemetryEnv = Pick<
  ServerEnv,
  | 'serverUrl'
  | 'protection'
  | 'fetch'
  | 'observabilityCollectorUrl'
  | 'observabilityLogsUrl'
  | 'observabilityMetricsUrl'
  | 'observabilityEnvironment'
  | 'observabilityCollectorUser'
  | 'observabilityCollectorToken'
>;
export function mountBrowserTelemetryIngress(
  shell: Hono<ApiHonoEnv<AuthContext>>,
  env: BrowserTelemetryEnv
): void {
  shell.post('/observability/v1/:signal', async (c) => {
    const signal = c.req.param('signal');
    if (!isSignal(signal))
      return c.json({ error: 'observability_signal_denied' }, 404);
    const endpoints = {
      traces: env.observabilityCollectorUrl,
      logs: env.observabilityLogsUrl,
      metrics: env.observabilityMetricsUrl,
    };
    const endpoint = endpoints[signal]?.trim();
    if (endpoint === undefined || endpoint.length === 0) {
      return c.json({ error: 'observability_unavailable' }, 503);
    }
    const denied = preflightDenied(c, env, signal);
    if (denied !== undefined) return denied;
    const contentType = c.req.header('content-type')?.toLowerCase() ?? '';
    const body = await readBoundedBody(c.req.raw, MAX_BROWSER_TELEMETRY_BYTES);
    if (body === null) {
      return c.json({ error: 'observability_payload_too_large' }, 413);
    }
    const outgoingBody = diagnosticBody(body, signal, env, {
      json: contentType.startsWith('application/json'),
      encoded: c.req.header('content-encoding') !== undefined,
    });
    if (outgoingBody === undefined)
      return c.json({ error: 'observability_schema_denied' }, 422);
    const headers = new Headers({
      'content-type': contentType,
    });
    const contentEncoding = c.req.header('content-encoding');
    if (contentEncoding !== undefined) {
      headers.set('content-encoding', contentEncoding);
    }
    const authorization = otlpAuthorization({
      user: env.observabilityCollectorUser,
      token: env.observabilityCollectorToken,
    });
    if (authorization !== undefined) {
      headers.set('authorization', authorization);
    }
    const response = await env.fetch(endpoint, {
      method: 'POST',
      headers,
      body: outgoingBody,
    });
    await response.body?.cancel();
    return new Response(null, { status: response.status });
  });
}

async function readBoundedBody(
  request: Request,
  maxBytes: number
): Promise<ArrayBuffer | null> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (request.body === null) return new ArrayBuffer(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel('observability payload too large');
        return null;
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer as ArrayBuffer;
}

function isSignal(value: string): value is Signal {
  return ['traces', 'logs', 'metrics'].includes(value);
}

function preflightDenied(
  c: IngressContext,
  env: BrowserTelemetryEnv,
  signal: Signal
): Response | undefined {
  const expectedOrigin =
    env.serverUrl === null ? null : resolveWebClientOrigin(env.serverUrl);
  const requestOrigin = c.req.header('origin')?.replace(/\/$/, '');
  if (
    env.protection === 'production' &&
    (expectedOrigin === null || requestOrigin !== expectedOrigin)
  )
    return c.json({ error: 'observability_origin_denied' }, 403);
  const contentType = c.req.header('content-type')?.toLowerCase() ?? '';
  if (
    !contentType.startsWith('application/x-protobuf') &&
    !contentType.startsWith('application/json')
  )
    return c.json({ error: 'observability_content_type_denied' }, 415);
  if (
    signal !== 'traces' &&
    (!contentType.startsWith('application/json') ||
      c.req.header('content-encoding'))
  )
    return c.json({ error: 'observability_content_type_denied' }, 415);
  return undefined;
}

function diagnosticBody(
  body: ArrayBuffer,
  signal: Signal,
  env: BrowserTelemetryEnv,
  encoding: { readonly json: boolean; readonly encoded: boolean }
): ArrayBuffer | undefined {
  const identity = {
    serviceName: BROWSER_SERVICE_NAME,
    environment: env.observabilityEnvironment ?? 'local',
  };
  if (signal === 'traces') {
    // The page's own exporter sends plain JSON. Protobuf or compressed bodies
    // cannot be restated here and go on as sent.
    if (!encoding.json || encoding.encoded) return body;
    try {
      const stamped = stampBrowserTraceResource(
        JSON.parse(new TextDecoder().decode(body)),
        identity
      );
      return stamped === undefined
        ? undefined
        : new TextEncoder().encode(JSON.stringify(stamped)).buffer;
    } catch {
      return undefined;
    }
  }
  try {
    const safe = sanitizeBrowserOtlp(
      JSON.parse(new TextDecoder().decode(body)),
      signal,
      identity
    );
    return safe === undefined
      ? undefined
      : new TextEncoder().encode(JSON.stringify(safe)).buffer;
  } catch {
    return undefined;
  }
}
