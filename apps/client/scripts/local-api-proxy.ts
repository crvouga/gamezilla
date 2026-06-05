/**
 * Shared loopback reverse proxy for web preview and Expo dev.
 * Keeps Better Auth cookies first-party on :5173 while forwarding worker
 * routes to wrangler (`LOCAL_PREVIEW_API_PROXY_TARGET`, default :8788).
 */
import type { ServerWebSocket } from 'bun';

import { assert } from '@pkgs/assert';

const DEFAULT_API_PROXY_TARGET = 'http://127.0.0.1:8788';

export function resolveLocalPreviewApiProxyTarget(): string {
  const raw =
    process.env['LOCAL_PREVIEW_API_PROXY_TARGET'] ?? DEFAULT_API_PROXY_TARGET;
  let origin = '';
  assert.notThrows(
    () => {
      origin = new URL(raw).origin;
    },
    'LOCAL_PREVIEW_API_PROXY_TARGET must parse as a URL',
    { raw }
  );
  assert.nonEmptyString(origin, 'proxy target origin must be non-empty');
  return origin;
}

export function isProxiedHttpApiPath(pathname: string): boolean {
  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/patch-db/')
  );
}

export function isProxiedRoomWebSocketPath(pathname: string): boolean {
  return pathname === '/room';
}

export function stripHopByHopEncodingHeaders(headers: Headers): void {
  // Bun's `fetch` decompresses upstream bodies but can leave `Content-Encoding`
  // on the Response headers. Forwarding those to the browser causes
  // ERR_CONTENT_DECODING_FAILED on `/api/*` auth and patch-db calls.
  headers.delete('content-encoding');
  headers.delete('content-length');
}

export async function proxyHttpRequest(
  req: Request,
  url: URL,
  targetOrigin: string
): Promise<Response> {
  const upstream = new URL(`${url.pathname}${url.search}`, targetOrigin);
  const headers = new Headers(req.headers);
  headers.set('host', upstream.host);
  const res = await fetch(upstream, {
    method: req.method,
    headers,
    ...(req.method !== 'GET' && req.method !== 'HEAD' ? { body: req.body } : {}),
    redirect: 'manual',
  });
  const outHeaders = new Headers(res.headers);
  stripHopByHopEncodingHeaders(outHeaders);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: outHeaders,
  });
}

type WebSocketProxyData = {
  upstreamUrl: string;
  upstream?: WebSocket;
  pendingFromClient: WebSocketMessage[];
};

type WebSocketMessage = Parameters<ServerWebSocket<WebSocketProxyData>['send']>[0];

function httpOriginToWebSocketOrigin(origin: string): string {
  return origin.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
}

function buildWebSocketUpstreamUrl(
  reqUrl: URL,
  targetOrigin: string
): string {
  const wsOrigin = httpOriginToWebSocketOrigin(targetOrigin);
  return `${wsOrigin}${reqUrl.pathname}${reqUrl.search}`;
}

type ProxyClientSocket = ServerWebSocket<WebSocketProxyData>;

function flushPendingToUpstream(data: WebSocketProxyData): void {
  const upstream = data.upstream;
  if (upstream === undefined || upstream.readyState !== WebSocket.OPEN) return;
  const queued = data.pendingFromClient;
  data.pendingFromClient = [];
  for (const message of queued) {
    sendToUpstream(data, message);
  }
}

export function sendToUpstream(
  data: WebSocketProxyData,
  message: WebSocketMessage
): void {
  const upstream = data.upstream;
  if (upstream === undefined) return;
  // Sending while CONNECTING/CLOSING/CLOSED throws `InvalidStateError`; queue
  // frames that arrive before the upstream handshake completes and drop the
  // rest so a closing socket can never crash the proxy process.
  if (upstream.readyState === WebSocket.CONNECTING) {
    data.pendingFromClient.push(message);
    return;
  }
  if (upstream.readyState !== WebSocket.OPEN) return;
  try {
    upstream.send(message);
  } catch {}
}

function sendToClient(client: ProxyClientSocket, message: WebSocketMessage): void {
  if (client.readyState !== WebSocket.OPEN) return;
  try {
    client.send(message);
  } catch {}
}

function attachUpstreamWebSocket(
  client: ProxyClientSocket,
  upstreamUrl: string
): void {
  const upstream = new WebSocket(upstreamUrl);
  client.data.upstream = upstream;
  upstream.addEventListener('open', () => {
    flushPendingToUpstream(client.data);
  });
  upstream.addEventListener('message', (event) => {
    sendToClient(client, event.data as WebSocketMessage);
  });
  upstream.addEventListener('close', () => {
    client.close();
  });
  upstream.addEventListener('error', () => {
    client.close();
  });
}

export type WebDevProxyServerOptions = {
  port: number;
  /** Metro / static web origin (e.g. `http://127.0.0.1:5174`). */
  webTarget: string;
  /** Wrangler dev origin (e.g. `http://127.0.0.1:8788`). */
  apiTarget?: string;
  /** Called for non-API HTTP routes when `webTarget` is omitted (static export). */
  serveWeb?: (pathname: string) => Response | Promise<Response>;
  logLabel?: string;
};

export function startWebDevProxyServer(
  options: WebDevProxyServerOptions
): ReturnType<typeof Bun.serve> {
  const apiTarget = options.apiTarget ?? resolveLocalPreviewApiProxyTarget();
  let webTarget = '';
  if (options.webTarget.length > 0) {
    assert.notThrows(
      () => {
        webTarget = new URL(options.webTarget).origin;
      },
      'webTarget must parse as a URL',
      { webTarget: options.webTarget }
    );
  }
  assert.ok(
    options.serveWeb !== undefined || webTarget.length > 0,
    'startWebDevProxyServer requires webTarget or serveWeb'
  );

  const server = Bun.serve<WebSocketProxyData>({
    port: options.port,
    async fetch(req, bunServer) {
      const url = new URL(req.url);
      const upgrade = req.headers.get('upgrade')?.toLowerCase();
      if (upgrade === 'websocket') {
        const targetOrigin = isProxiedRoomWebSocketPath(url.pathname)
          ? apiTarget
          : webTarget;
        assert.nonEmptyString(
          targetOrigin,
          'websocket proxy requires a webTarget for non-/room upgrades'
        );
        const upstreamUrl = buildWebSocketUpstreamUrl(url, targetOrigin);
        const ok = bunServer.upgrade(req, {
          data: { upstreamUrl, pendingFromClient: [] },
        });
        if (!ok) {
          return new Response('WebSocket upgrade failed', { status: 500 });
        }
        return undefined;
      }

      if (isProxiedHttpApiPath(url.pathname)) {
        return proxyHttpRequest(req, url, apiTarget);
      }

      if (options.serveWeb !== undefined) {
        return options.serveWeb(url.pathname);
      }
      return proxyHttpRequest(req, url, webTarget);
    },
    websocket: {
      open(ws) {
        attachUpstreamWebSocket(ws, ws.data.upstreamUrl);
      },
      message(ws, message) {
        sendToUpstream(ws.data, message);
      },
      close(ws) {
        ws.data.upstream?.close();
      },
    },
  });

  const label = options.logLabel ?? 'web-dev-proxy';
  process.stdout.write(
    `[${label}] web=${server.url.origin} api-proxy=${apiTarget}` +
      (webTarget.length > 0 ? ` web-target=${webTarget}` : '') +
      '\n'
  );
  return server;
}
