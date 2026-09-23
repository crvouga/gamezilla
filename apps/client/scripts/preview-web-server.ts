/**
 * Static server for the production web build (`dist/`), optionally proxying
 * `/api/*` (HTTP and WebSocket upgrades, e.g. `/api/room`) to an API origin
 * so a production-shaped bundle can talk same-origin (Lighthouse / local
 * preview). `intercept` lets a harness answer
 * extra routes (the e2e Dev IdP robot) before static / proxy handling.
 */

import { join } from 'node:path';
import { assert } from '@pkgs/assert';
import { file, type Server, type ServerWebSocket } from 'bun';

import { previewStackReadyResponse } from './preview-stack-ready';
import { applySqliteWebIsolationHeadersToFetch } from './sqlite-web-headers.js';

const DIST_DIR = join(import.meta.dir, '..', 'dist');
const INDEX_HTML = join(DIST_DIR, 'index.html');

export type PreviewWebServerOptions = {
  /** Preferred port; falls back to an ephemeral port when busy (unless `0`). */
  readonly port: number;
  /** When non-empty, `/api/*` is proxied here. */
  readonly apiProxyOrigin?: string;
  readonly intercept?: (req: Request) => Promise<Response | null>;
};

function resolveStaticPath(pathname: string): string {
  const safe = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  if (safe.length === 0) return INDEX_HTML;
  return join(DIST_DIR, safe);
}

function withIsolation(res: Response): Response {
  const headers = new Headers(res.headers);
  applySqliteWebIsolationHeadersToFetch(headers);
  return new Response(res.body, { status: res.status, headers });
}

async function proxyApi(
  req: Request,
  apiProxyOrigin: string
): Promise<Response> {
  const inbound = new URL(req.url);
  const base = apiProxyOrigin.endsWith('/')
    ? apiProxyOrigin
    : `${apiProxyOrigin}/`;
  const target = new URL(`${inbound.pathname}${inbound.search}`, base);
  const method = req.method;
  const init: RequestInit = {
    method,
    headers: req.headers,
    redirect: 'manual',
  };
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    init.body = await req.arrayBuffer();
  }
  const upstream = await fetch(target, init);
  return withIsolation(
    new Response(upstream.body, {
      status: upstream.status,
      headers: upstream.headers,
    })
  );
}

async function serveStatic(
  pathname: string,
  indexFile: ReturnType<typeof file>
): Promise<Response> {
  if (pathname === '/ready') {
    return previewStackReadyResponse();
  }
  const diskPath = resolveStaticPath(pathname);
  const candidate = file(diskPath);
  const body = (await candidate.exists()) ? candidate : indexFile;
  const headers = new Headers();
  applySqliteWebIsolationHeadersToFetch(headers);
  return new Response(body, { headers });
}

/** A proxied browser socket and its upstream API socket. */
type ProxySocket = {
  readonly target: string;
  upstream: WebSocket | null;
  readonly pending: (string | Uint8Array<ArrayBuffer>)[];
};

/** Detach a Bun frame from its (possibly shared) backing buffer. */
function ownFrame(frame: string | Buffer): string | Uint8Array<ArrayBuffer> {
  return typeof frame === 'string' ? frame : new Uint8Array(frame);
}

function upstreamWebSocketUrl(req: Request, apiProxyOrigin: string): string {
  const inbound = new URL(req.url);
  const target = new URL(
    `${inbound.pathname}${inbound.search}`,
    apiProxyOrigin
  );
  target.protocol = target.protocol === 'https:' ? 'wss:' : 'ws:';
  return target.toString();
}

const proxySocketHandlers = {
  open(ws: ServerWebSocket<ProxySocket>) {
    const upstream = new WebSocket(ws.data.target);
    ws.data.upstream = upstream;
    upstream.addEventListener('open', () => {
      for (const frame of ws.data.pending.splice(0)) upstream.send(frame);
    });
    upstream.addEventListener('message', (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (typeof data === 'string') ws.send(data);
      else if (data instanceof ArrayBuffer) ws.send(new Uint8Array(data));
    });
    upstream.addEventListener('close', (event) => {
      ws.close(event.code === 1005 ? 1000 : event.code, event.reason);
    });
    upstream.addEventListener('error', () => {
      ws.close(1011, 'upstream error');
    });
  },
  message(ws: ServerWebSocket<ProxySocket>, frame: string | Buffer) {
    const upstream = ws.data.upstream;
    if (upstream !== null && upstream.readyState === WebSocket.OPEN) {
      upstream.send(ownFrame(frame));
      return;
    }
    ws.data.pending.push(ownFrame(frame));
  },
  close(ws: ServerWebSocket<ProxySocket>) {
    ws.data.upstream?.close();
  },
};

function isAddrInUse(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    err.code === 'EADDRINUSE'
  );
}

export function startPreviewWebServer(
  options: PreviewWebServerOptions
): Server<ProxySocket> {
  const indexFile = file(INDEX_HTML);
  assert.ok(
    indexFile.size > 0,
    'dist/index.html must exist — run `bun run --filter @apps/client build` first',
    { path: INDEX_HTML }
  );
  const apiProxyOrigin = options.apiProxyOrigin?.trim() ?? '';
  const fetchHandler = async (
    req: Request,
    server: Server<ProxySocket>
  ): Promise<Response | undefined> => {
    const intercepted = (await options.intercept?.(req)) ?? null;
    if (intercepted !== null) return intercepted;
    const url = new URL(req.url);
    if (apiProxyOrigin.length > 0 && url.pathname.startsWith('/api/')) {
      if (req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
        const data = {
          target: upstreamWebSocketUrl(req, apiProxyOrigin),
          upstream: null,
          pending: [],
        };
        if (server.upgrade(req, { data })) return undefined;
      }
      return proxyApi(req, apiProxyOrigin);
    }
    return serveStatic(url.pathname, indexFile);
  };
  const serve = (port: number) =>
    Bun.serve<ProxySocket>({
      port,
      fetch: fetchHandler,
      websocket: proxySocketHandlers,
    });
  try {
    return serve(options.port);
  } catch (err) {
    if (!isAddrInUse(err) || options.port === 0) throw err;
    return serve(0);
  }
}
