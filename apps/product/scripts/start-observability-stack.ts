// @io-wall-ok — tools composition root owns local listeners and optional Docker.

import { type ChildProcess, spawn } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { reservePort, waitForHttp } from './free-port';
import type { ObservabilityBackend } from './stack-options';

const LGTM_IMAGE = 'grafana/otel-lgtm:0.30.0';
const MAX_OTLP_BODY_BYTES = 5 * 1024 * 1024;

export type ObservabilityStack = {
  /** Exact OTLP/HTTP trace endpoint consumed by every application runtime. */
  readonly collectorUrl: string;
  /** Native NDJSON source consumed directly by `bun obs`. */
  readonly traceDir: string | null;
  /** Optional Tempo query origin when the LGTM backend was requested. */
  readonly tempoUrl: string | null;
  readonly grafanaUrl: string | null;
  stop(): Promise<void>;
};

function safeContainerName(instanceId: string): string {
  const suffix = instanceId.toLowerCase().replace(/[^a-z0-9_.-]/g, '-');
  return `gamezilla-observability-${suffix}`;
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

function isOtlpDocument(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  return Array.isArray((value as Record<string, unknown>)['resourceSpans']);
}

/** Fast, dependency-free OTLP/HTTP JSON receiver for normal local development. */
async function startNativeCollector(
  dataDir: string
): Promise<ObservabilityStack> {
  mkdirSync(dataDir, { recursive: true });
  const tracePath = join(dataDir, 'spans.ndjson');
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    maxRequestBodySize: MAX_OTLP_BODY_BYTES,
    async fetch(request) {
      const url = new URL(request.url);
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }
      if (request.method !== 'POST' || url.pathname !== '/v1/traces') {
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
      if (!isOtlpDocument(document)) {
        return new Response('resourceSpans required', { status: 400 });
      }
      appendFileSync(tracePath, `${JSON.stringify(document)}\n`, 'utf8');
      return new Response(null, { status: 200, headers: corsHeaders() });
    },
  });
  return {
    collectorUrl: `${server.url.origin}/v1/traces`,
    traceDir: dataDir,
    tempoUrl: null,
    grafanaUrl: null,
    stop: () => server.stop(true),
  };
}

/** Optional full Grafana + Tempo UI for developers who explicitly request it. */
async function startLgtmCollector(args: {
  readonly instanceId: string;
  readonly dataDir: string;
}): Promise<ObservabilityStack> {
  const collectorPort = reservePort();
  const tempoPort = reservePort();
  const grafanaPort = reservePort();
  await Promise.all([
    collectorPort.release(),
    tempoPort.release(),
    grafanaPort.release(),
  ]);
  mkdirSync(args.dataDir, { recursive: true });
  const child = spawn(
    'docker',
    [
      'run',
      '--rm',
      '--name',
      safeContainerName(args.instanceId),
      '--label',
      'gamezilla.sidecar=observability',
      '--publish',
      `127.0.0.1:${String(collectorPort.port)}:4318`,
      '--publish',
      `127.0.0.1:${String(tempoPort.port)}:3200`,
      '--publish',
      `127.0.0.1:${String(grafanaPort.port)}:3000`,
      '--volume',
      `${args.dataDir}:/data`,
      LGTM_IMAGE,
    ],
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
    collectorUrl: `http://127.0.0.1:${String(collectorPort.port)}/v1/traces`,
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

export function startObservabilityStack(args: {
  readonly backend: Exclude<ObservabilityBackend, 'off'>;
  readonly instanceId: string;
  readonly dataDir: string;
}): Promise<ObservabilityStack> {
  return args.backend === 'native'
    ? startNativeCollector(args.dataDir)
    : startLgtmCollector(args);
}
