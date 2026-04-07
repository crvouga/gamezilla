import {
  createPatchDbApiHandler,
  type PatchDbApiConfig,
} from '@gamezilla/patch-db/api';

/**
 * Platform-agnostic handler for real-time event streams (SSE / WebSocket).
 * Cloudflare forwards these to a Durable Object; other runtimes can use any
 * push mechanism.
 */
export type EventsHandler = (request: Request) => Promise<Response>;

export type ApiHandlerConfig = PatchDbApiConfig & {
  eventsHandler?: EventsHandler;
};

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    headers.set(k, v);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export function createApiHandler(
  config: ApiHandlerConfig,
): (request: Request) => Promise<Response> {
  const { handleRequest, basePath } = createPatchDbApiHandler(config);
  const { eventsHandler } = config;

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === '/health') {
      return withCors(
        new Response('ok', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        }),
      );
    }

    if (
      eventsHandler &&
      url.pathname.endsWith('/events') &&
      request.method === 'GET'
    ) {
      const res = await eventsHandler(request);
      return withCors(res);
    }

    try {
      if (url.pathname.startsWith(basePath)) {
        const res = await handleRequest(request);
        if (res === null) {
          return withCors(
            new Response('Not Found', {
              status: 404,
              headers: { 'Content-Type': 'text/plain' },
            }),
          );
        }
        return withCors(res);
      }
    } catch (err: unknown) {
      console.error('[api] handler error:', err);
      const message = err instanceof Error ? err.message : String(err);
      return withCors(
        new Response(JSON.stringify({ error: message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }

    return withCors(
      new Response('Not Found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );
  };
}
