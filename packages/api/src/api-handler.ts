import {
  createPatchDbApiHandler,
  type PatchDbApiConfig,
} from '@gamezilla/patch-db/api';
import { handleAuthClaim } from './auth/claim-handler';
import { UnauthorizedError } from './auth/unauthorized-error';
import { createLogger } from '@gamezilla/shared/logger';
import type { PatchesDb } from '@gamezilla/patch-db/interface';

export type ApiHandlerConfig = PatchDbApiConfig & {
  /** Google OAuth Web client ID; optional audience check on id_token. */
  googleClientId?: string;
};

const log = createLogger({ name: 'api:handler' });

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Cache-Control, Pragma, Authorization',
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
  config: ApiHandlerConfig
): (request: Request) => Promise<Response> {
  const { handleRequest, basePath } = createPatchDbApiHandler(config);
  const db = config.db as PatchesDb;
  const googleClientId: string | undefined = config.googleClientId;

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
        })
      );
    }

    if (url.pathname === '/client-config' && request.method === 'GET') {
      const googleWebClientId =
        googleClientId !== undefined && googleClientId !== ''
          ? googleClientId
          : null;
      return withCors(
        new Response(JSON.stringify({ googleWebClientId }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }

    try {
      if (url.pathname === '/auth/claim' && request.method === 'POST') {
        const text = await request.text();
        let body: unknown;
        try {
          body = text.length > 0 ? (JSON.parse(text) as unknown) : null;
        } catch {
          return withCors(
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }
        return withCors(
          await handleAuthClaim(
            db,
            body,
            googleClientId !== undefined && googleClientId !== ''
              ? { googleClientId }
              : {}
          )
        );
      }

      if (url.pathname.startsWith(basePath)) {
        const res = await handleRequest(request);
        if (res === null) {
          return withCors(
            new Response('Not Found', {
              status: 404,
              headers: { 'Content-Type': 'text/plain' },
            })
          );
        }
        return withCors(res);
      }
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) {
        return withCors(
          new Response(JSON.stringify({ error: err.message }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      const message = err instanceof Error ? err.message : String(err);
      log.error('handler error', { error: message });
      return withCors(
        new Response(JSON.stringify({ error: message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }

    return withCors(
      new Response('Not Found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      })
    );
  };
}
