// @io-wall-ok — tools composition root owns local listeners and optional Docker.

import type { ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  technicalKey,
  technicalName,
} from '@libs/product-identity-shared-ts/technical-names';
import { registerDevContainer } from '@pkgs/dev-owner-server-ts/dev-owner-resources';
import { spawnOwned as spawn } from '@pkgs/dev-owner-server-ts/dev-owner-spawn';

import { plannedPort, reservePort, waitForHttp } from './free-port';
import type { ObservabilityBackend } from './stack-options';

const LGTM_IMAGE = 'grafana/otel-lgtm:0.30.0';
const MAX_OTLP_BODY_BYTES = 5 * 1024 * 1024;

export type ObservabilityStack = {
  /** Exact OTLP/HTTP trace endpoint consumed by every application runtime. */
  readonly collectorUrl: string;
  /** Exact OTLP/HTTP logs endpoint. Same collector, logs signal. */
  readonly logsUrl: string;
  /** Exact OTLP/HTTP metrics endpoint. Same collector, metrics signal. */
  readonly metricsUrl: string;
  /** Native NDJSON source consumed directly by `bun obs`. */
  readonly traceDir: string | null;
  /** Optional Tempo query origin when the LGTM backend was requested. */
  readonly tempoUrl: string | null;
  readonly grafanaUrl: string | null;
  stop(): Promise<void>;
};

/** The native collector binds only `collector`; LGTM publishes all three. */
export type ObservabilityPorts = {
  readonly collector: number;
  readonly tempo: number;
  readonly grafana: number;
};

function portFor(planned: number | undefined) {
  return planned === undefined ? reservePort() : plannedPort(planned);
}

const SIGNAL_FILES = {
  '/v1/traces': { file: 'spans.ndjson', field: 'resourceSpans' },
  '/v1/logs': { file: 'logs.ndjson', field: 'resourceLogs' },
  '/v1/metrics': { file: 'metrics.ndjson', field: 'resourceMetrics' },
} as const;

function signalUrls(origin: string): {
  readonly collectorUrl: string;
  readonly logsUrl: string;
  readonly metricsUrl: string;
} {
  return {
    collectorUrl: `${origin}/v1/traces`,
    logsUrl: `${origin}/v1/logs`,
    metricsUrl: `${origin}/v1/metrics`,
  };
}

function safeContainerName(instanceId: string): string {
  const suffix = instanceId.toLowerCase().replace(/[^a-z0-9_.-]/g, '-');
  const rootHash = createHash('sha256')
    .update(process.env['DEV_OWNER_ROOT'] ?? process.cwd())
    .digest('hex')
    .slice(0, 12);
  return `${technicalName(['observability', rootHash])}-${suffix}`;
}

function childExit(child: ChildProcess): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  child.once('exit', () => resolve());
  child.once('error', () => resolve());
  return promise;
}

function corsHeaders(): HeadersInit {
  return {
    'access-control-allow-headers': 'content-type,traceparent,tracestate',
    'access-control-allow-methods': 'POST,OPTIONS',
    'access-control-allow-origin': '*',
  };
}

function signalFor(pathname: string): {
  readonly file: string;
  readonly field: string;
} | null {
  if (!Object.hasOwn(SIGNAL_FILES, pathname)) return null;
  return SIGNAL_FILES[pathname as keyof typeof SIGNAL_FILES];
}

function isSignalDocument(
  value: unknown,
  field: string
): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  return Array.isArray((value as Record<string, unknown>)[field]);
}

/** Fast, dependency-free OTLP/HTTP JSON receiver for normal local development. */
async function startNativeCollector(
  dataDir: string,
  ports: ObservabilityPorts | undefined,
  instanceId: string,
  upstream?: ObservabilityStack
): Promise<ObservabilityStack> {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(
    join(dataDir, 'trace-source.json'),
    JSON.stringify({
      instanceId,
      startedAtMs: Date.now(),
      observabilityTraceDir: dataDir,
    })
  );
  const reservation = portFor(ports?.collector);
  await reservation.release();
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: reservation.port,
    maxRequestBodySize: MAX_OTLP_BODY_BYTES,
    async fetch(request) {
      const url = new URL(request.url);
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }
      const signal = signalFor(url.pathname);
      if (request.method !== 'POST' || signal === null) {
        return new Response('not found', { status: 404 });
      }
      const contentType = request.headers.get('content-type') ?? '';
      if (!contentType.toLowerCase().startsWith('application/json')) {
        return new Response('OTLP/HTTP JSON required', { status: 415 });
      }
      const text = await request.text();
      let document: unknown;
      try {
        document = JSON.parse(text);
      } catch {
        return new Response('invalid OTLP JSON', { status: 400 });
      }
      if (!isSignalDocument(document, signal.field)) {
        return new Response(`${signal.field} required`, { status: 400 });
      }
      appendFileSync(
        join(dataDir, signal.file),
        `${JSON.stringify(document)}\n`,
        'utf8'
      );
      if (upstream !== undefined) {
        const endpoint =
          url.pathname === '/v1/traces'
            ? upstream.collectorUrl
            : url.pathname === '/v1/logs'
              ? upstream.logsUrl
              : upstream.metricsUrl;
        try {
          const forwarded = await fetch(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: text,
            signal: AbortSignal.timeout(5_000),
          });
          if (!forwarded.ok) {
            await forwarded.body?.cancel();
            return new Response('upstream collector refused signal', {
              status: 502,
              headers: corsHeaders(),
            });
          }
          return new Response(forwarded.body, {
            status: forwarded.status,
            headers: { ...corsHeaders(), 'content-type': 'application/json' },
          });
        } catch {
          return new Response(
            'upstream collector unavailable; local copy retained',
            { status: 502, headers: corsHeaders() }
          );
        }
      }
      return new Response(null, { status: 200, headers: corsHeaders() });
    },
  });
  return {
    ...signalUrls(server.url.origin),
    traceDir: dataDir,
    tempoUrl: upstream?.tempoUrl ?? null,
    grafanaUrl: upstream?.grafanaUrl ?? null,
    async stop() {
      await server.stop(true);
      await upstream?.stop();
    },
  };
}

function lgtmArgs(args: {
  dataDir: string;
  containerName: string;
  collectorPort: { port: number };
  tempoPort: { port: number };
  grafanaPort: { port: number };
}): string[] {
  const { containerName, collectorPort, tempoPort, grafanaPort } = args;
  return [
    'run',
    '--rm',
    '--env',
    `DEV_OWNER_ROOT=${process.env['DEV_OWNER_ROOT'] ?? ''}`,
    '--env',
    `DEV_OWNER_BOOT=${process.env['DEV_OWNER_BOOT'] ?? ''}`,
    '--label',
    `dev.owner.root=${process.env['DEV_OWNER_ROOT'] ?? ''}`,
    '--label',
    `dev.owner.boot=${process.env['DEV_OWNER_BOOT'] ?? ''}`,
    '--name',
    containerName,
    '--label',
    `${technicalKey('sidecar')}=observability`,
    '--publish',
    `127.0.0.1:${String(collectorPort.port)}:4318`,
    '--publish',
    `127.0.0.1:${String(tempoPort.port)}:3200`,
    '--publish',
    `127.0.0.1:${String(grafanaPort.port)}:3000`,
    '--volume',
    `${args.dataDir}:/data`,
    LGTM_IMAGE,
  ];
}

/** Optional full Grafana + Tempo UI for developers who explicitly request it. */
async function startLgtmCollector(args: {
  readonly instanceId: string;
  readonly dataDir: string;
  readonly ports?: ObservabilityPorts | undefined;
}): Promise<ObservabilityStack> {
  // The planned collector port belongs to the durable local gateway.
  const collectorPort = reservePort();
  const tempoPort = portFor(args.ports?.tempo);
  const grafanaPort = portFor(args.ports?.grafana);
  await Promise.all([
    collectorPort.release(),
    tempoPort.release(),
    grafanaPort.release(),
  ]);
  mkdirSync(args.dataDir, { recursive: true });
  const containerName = safeContainerName(args.instanceId);
  registerDevContainer(containerName);
  const child = spawn(
    'docker',
    lgtmArgs({
      dataDir: args.dataDir,
      containerName,
      collectorPort,
      tempoPort,
      grafanaPort,
    }),
    { stdio: 'inherit' }
  );
  const tempoUrl = `http://127.0.0.1:${String(tempoPort.port)}`;
  try {
    await Promise.race([
      waitForHttp(`${tempoUrl}/ready`, 90_000),
      childExit(child).then(() => {
        throw new Error('LGTM sidecar exited before ready; start Docker');
      }),
    ]);
  } catch (error) {
    child.kill('SIGTERM');
    throw error;
  }
  return {
    ...signalUrls(`http://127.0.0.1:${String(collectorPort.port)}`),
    traceDir: null,
    tempoUrl,
    grafanaUrl: `http://127.0.0.1:${String(grafanaPort.port)}`,
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = childExit(child);
      child.kill('SIGTERM');
      await exited;
    },
  };
}

export async function startObservabilityStack(args: {
  readonly backend: Exclude<ObservabilityBackend, 'off'>;
  readonly instanceId: string;
  readonly dataDir: string;
  /** Planned ports; without them each listener asks the OS for its own. */
  readonly ports?: ObservabilityPorts | undefined;
}): Promise<ObservabilityStack> {
  const upstream =
    args.backend === 'lgtm' ? await startLgtmCollector(args) : undefined;
  try {
    return await startNativeCollector(
      args.dataDir,
      args.ports,
      args.instanceId,
      upstream
    );
  } catch (error) {
    await upstream?.stop();
    throw error;
  }
}
