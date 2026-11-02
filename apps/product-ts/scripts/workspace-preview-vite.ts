// @io-wall-ok — Vite development HTTP composition root.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import type { Plugin, ProxyOptions, ServerOptions } from 'vite';
import { devStackOptions } from './dev-options';
import { readPlan } from './stack-plan-file';
import { workspacePreviewResponse } from './workspace-preview-http';
import {
  type PreviewRoute,
  previewRoute,
  workspacePreviewRoutes,
} from './workspace-preview-routes';
import { quickPreviewOrigin } from './workspace-preview-runtime';
import {
  localWorkspacePreviewScope,
  workspacePreviewKey,
} from './workspace-preview-scope';

const PRIVATE_PREVIEW_FILES = [
  '.env',
  '.env.*',
  '.npmrc',
  '*.{crt,pem,key}',
  '**/.git/**',
  '**/.cache/**',
  '**/*.tfstate*',
];

async function browserRequest(
  req: IncomingMessage,
  origin: string
): Promise<Request> {
  const headers = new Headers();
  for (const [name, values] of Object.entries(req.headers)) {
    if (Array.isArray(values))
      values.forEach((value) => headers.append(name, value));
    else if (values !== undefined) headers.set(name, values);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const method = req.method ?? 'GET';
  return new Request(new URL(req.url ?? '/', origin), {
    method,
    headers,
    ...(method === 'GET' || method === 'HEAD'
      ? {}
      : { body: Uint8Array.from(Buffer.concat(chunks)).buffer }),
  });
}

function sendResponse(response: Response, res: ServerResponse): void {
  res.statusCode = response.status;
  for (const [name, value] of response.headers)
    if (name !== 'set-cookie') res.setHeader(name, value);
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) res.setHeader('set-cookie', cookies);
  if (response.body === null) {
    res.end();
    return;
  }
  const body = Readable.from(response.body);
  body.once('error', () => res.destroy());
  res.once('close', () => body.destroy());
  body.pipe(res);
}

function socketProxy(route: PreviewRoute, webOrigin: string): ProxyOptions {
  return {
    target: route.origin,
    changeOrigin: true,
    ws: true,
    rewrite: (path) => path.slice(route.prefix.length) || '/',
    configure: (proxy) => {
      proxy.on('proxyReqWs', (request) =>
        request.setHeader('origin', webOrigin)
      );
    },
  };
}

function previewBrowserOrigin(
  host: string,
  webOrigin: string,
  hostname: string,
  remoteOrigin: string | null
): string | null {
  if (host === hostname) return remoteOrigin;
  const local = new URL(webOrigin);
  if (
    ['127.0.0.1', 'localhost', '[::1]'].some(
      (name) => host === `${name}:${local.port}`
    )
  )
    return `http://${host}`;
  return null;
}

function previewServerConfig(
  hostname: string,
  routes: readonly PreviewRoute[],
  webOrigin: string
): ServerOptions {
  return {
    allowedHosts: [hostname],
    fs: { deny: PRIVATE_PREVIEW_FILES },
    proxy: Object.fromEntries(
      routes
        .filter(
          (route) => route.origin.startsWith('ws:') || route === routes[0]
        )
        .map((route) => [route.prefix || '/api', socketProxy(route, webOrigin)])
    ),
  };
}

/** Development transports use the viewing origin, including dynamic tunnels. */
export function workspacePreviewVite(repoRoot: string): Plugin | null {
  if (
    process.env['LOCALHOST_STACK'] !== '1' ||
    process.env['LOCALHOST_STACK_INSTANCE'] !== 'dev'
  )
    return null;
  const workspaceKey = workspacePreviewKey(
    localWorkspacePreviewScope(repoRoot, 'dev')
  );
  const hostname = `${workspaceKey}-preview.localhost`;
  const plan = readPlan(repoRoot, devStackOptions().instanceId);
  const routes = workspacePreviewRoutes(plan);
  const web = routes[1];
  if (web === undefined || web.origin === '')
    throw new Error('Preview needs a planned web listener');
  const webOrigin = web.origin;
  return {
    name: 'workspace-preview',
    apply: 'serve',
    config: () => ({
      define: {
        'import.meta.env.VITE_LOCAL_PREVIEW_SAME_ORIGIN': JSON.stringify('1'),
        'import.meta.env.VITE_API_URL': 'globalThis.location.origin',
        'import.meta.env.VITE_LOCAL_PREVIEW_ROUTES': JSON.stringify(
          JSON.stringify(routes)
        ),
      },
      server: previewServerConfig(hostname, routes, webOrigin),
    }),
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const origin = previewBrowserOrigin(
          req.headers.host ?? '',
          webOrigin,
          hostname,
          quickPreviewOrigin(plan.dataDir, workspaceKey)
        );
        if (origin === null) {
          res.writeHead(403).end('Unknown preview host');
          return;
        }
        const allowed = server.config.server.allowedHosts;
        const browserHost = new URL(origin).hostname;
        if (Array.isArray(allowed) && !allowed.includes(browserHost))
          allowed.push(browserHost);
        const path = new URL(req.url ?? '/', origin).pathname;
        if (
          previewRoute(path, routes) === undefined &&
          !path.startsWith('/_preview/')
        ) {
          next();
          return;
        }
        void browserRequest(req, origin)
          .then((request) =>
            workspacePreviewResponse(request, {
              routes,
              publicOrigin: origin,
              http: { fetch },
            })
          )
          .then((response) => {
            if (response === null) next();
            else sendResponse(response, res);
          })
          .catch(() => {
            if (!res.headersSent)
              res
                .writeHead(502)
                .end(
                  'Local preview service is unavailable; check the stack and retry'
                );
            else res.destroy();
          });
      });
    },
  };
}
