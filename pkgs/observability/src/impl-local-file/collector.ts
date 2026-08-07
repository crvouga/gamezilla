import type { ExportedSpanRecord } from '../shared/types';
import { ObservabilityFileSink } from './file-sink';

export type CollectorOptions = {
  readonly port?: number;
  readonly host?: string;
  readonly rootDir?: string;
};

export type CollectorHandle = {
  readonly url: string;
  readonly port: number;
  readonly stop: () => void;
};

function parseSpanBody(body: unknown): ExportedSpanRecord[] {
  if (body === null || typeof body !== 'object') return [];
  const o = body as Record<string, unknown>;
  if (Array.isArray(o['spans'])) {
    return o['spans'].filter(isExportedSpanRecord);
  }
  if (isExportedSpanRecord(body)) return [body];
  return [];
}

function isExportedSpanRecord(v: unknown): v is ExportedSpanRecord {
  if (v === null || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o['traceId'] === 'string' &&
    typeof o['spanId'] === 'string' &&
    typeof o['name'] === 'string'
  );
}

export function startObservabilityCollector(
  options: CollectorOptions = {}
): CollectorHandle {
  const port = options.port ?? 8799;
  const host = options.host ?? '127.0.0.1';
  const sink = new ObservabilityFileSink(
    options.rootDir !== undefined ? { rootDir: options.rootDir } : {}
  );

  const server = Bun.serve({
    hostname: host,
    port,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.pathname === '/v1/spans' && req.method === 'POST') {
        return req
          .json()
          .then((body) => {
            for (const record of parseSpanBody(body)) {
              sink.write(record);
            }
            return new Response(JSON.stringify({ ok: true }), {
              headers: { 'Content-Type': 'application/json' },
            });
          })
          .catch(() => new Response('bad request', { status: 400 }));
      }
      return new Response('not found', { status: 404 });
    },
  });

  return {
    url: `http://${host}:${port}`,
    port: server.port ?? port,
    stop: () => server.stop(),
  };
}
