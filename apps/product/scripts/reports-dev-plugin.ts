// @io-wall-ok — Vite dev server mounts the reports API on the page origin
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, ViteDevServer } from 'vite';

export function isReportsApiPath(url: string | undefined): boolean {
  const path = (url ?? '').split('?')[0] ?? '';
  return path === '/api/reports' || path.startsWith('/api/reports/');
}

export function reportsDevPlugin(args: {
  readonly repoRoot: string;
  readonly appModule: string;
}): Plugin {
  return {
    name: 'gamezilla-reports-dev',
    apply: 'serve',
    configureServer(server) {
      if (process.env['PRODUCT_DEV_FROZEN'] === '1') return;
      server.middlewares.use((req, res, next) => {
        if (!isReportsApiPath(req.url)) {
          next();
          return;
        }
        void writeReports(req, res, server, args).catch((err: unknown) => {
          if (res.headersSent || res.writableEnded) return;
          res.statusCode = 500;
          res.end(err instanceof Error ? err.message : 'reports failed');
        });
      });
    },
  };
}

async function writeReports(
  req: IncomingMessage,
  res: ServerResponse,
  server: ViteDevServer,
  args: { readonly repoRoot: string; readonly appModule: string }
): Promise<void> {
  const host = req.headers.host ?? 'localhost';
  const app = (await server.ssrLoadModule(args.appModule)) as {
    reportsDevFetch: (request: Request, repoRoot: string) => Promise<Response>;
  };
  const response = await app.reportsDevFetch(
    new Request(`http://${host}${req.url ?? '/api/reports'}`, {
      method: req.method ?? 'GET',
      headers: requestHeaders(req),
    }),
    args.repoRoot
  );
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (key === 'transfer-encoding' || key === 'content-length') return;
    res.setHeader(key, value);
  });
  if (response.body === null) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  req.on('close', () => {
    void reader.cancel();
  });
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value !== undefined && !res.write(value)) {
      await new Promise<void>((resolveDrain) => {
        res.once('drain', () => resolveDrain());
      });
    }
  }
  res.end();
}

function requestHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(', '));
  }
  return headers;
}
