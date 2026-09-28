/**
 * Stub product API for shell tests: `/api/health` 200, anon identity echo,
 * empty sync query batches / mutation uploads. Records every request path so
 * tests can assert what the shell touched during boot.
 */

import type { ServerHttp } from '@libs/client-app/shell/client-env';

const JSON_HEADERS = { 'content-type': 'application/json' };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function readJsonBody(init: RequestInit | undefined): unknown {
  const body = init?.body;
  if (typeof body !== 'string' || body.length === 0) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function anonEnsureResponse(init: RequestInit | undefined): Response {
  const body = readJsonBody(init);
  const proposed =
    body !== null && typeof body === 'object' && 'userId' in body
      ? (body as { userId?: unknown }).userId
      : undefined;
  return jsonResponse({
    userId: typeof proposed === 'string' ? proposed : 'harness-anon-user',
  });
}

function queryBatchResponse(init: RequestInit | undefined): Response {
  const body = readJsonBody(init);
  const queries =
    body !== null && typeof body === 'object' && 'queries' in body
      ? (body as { queries?: unknown }).queries
      : undefined;
  const count = Array.isArray(queries) ? queries.length : 0;
  return jsonResponse({
    responses: Array.from({ length: count }, () => ({
      status: 'not_modified',
    })),
  });
}

export type HarnessServerFetch = {
  readonly fetch: ServerHttp;
  /** Request paths in call order (pathname only). */
  readonly requests: readonly string[];
};

export function createHarnessServerFetch(
  serverUrl: string
): HarnessServerFetch {
  const requests: string[] = [];
  const route = (url: URL, init: RequestInit | undefined): Response => {
    switch (url.pathname) {
      case '/api/health':
        return jsonResponse({ ok: true });
      case '/api/identity/anon/ensure':
        return anonEnsureResponse(init);
      case '/api/query':
        return queryBatchResponse(init);
      case '/api/mutations':
        return jsonResponse({ results: [] });
      default:
        return jsonResponse({ error: 'not_found' }, 404);
    }
  };
  const fetch: ServerHttp = (input, init) => {
    const url = new URL(requestUrl(input), serverUrl);
    requests.push(url.pathname);
    return Promise.resolve(route(url, init));
  };
  return { fetch, requests };
}
