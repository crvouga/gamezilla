import { browserPreviewOrigin } from './browser-origin';

export type BrowserPreviewRoute = {
  readonly origin: string;
  readonly prefix: string;
};

/** Resolve only the I/O destination; synchronized rows and signatures stay intact. */
export function resolveBrowserPreviewUrl(
  raw: string,
  publicOrigin: string,
  routes: readonly BrowserPreviewRoute[]
): string {
  let source: URL;
  try {
    source = new URL(raw);
  } catch {
    return raw;
  }
  const route = routes.find((candidate) => {
    const target = new URL(candidate.origin);
    const loopbacks = ['127.0.0.1', 'localhost', '[::1]'];
    return (
      source.protocol === target.protocol &&
      source.port === target.port &&
      (source.hostname === target.hostname ||
        (loopbacks.includes(source.hostname) &&
          loopbacks.includes(target.hostname)))
    );
  });
  if (route === undefined || source.username !== '' || source.password !== '')
    return raw;
  const origin = source.protocol.startsWith('ws')
    ? publicOrigin.replace(/^http/, 'ws')
    : publicOrigin;
  return new URL(
    `${route.prefix}${source.pathname}${source.search}${source.hash}`,
    origin
  ).href;
}

let cached: { raw: string; routes: readonly BrowserPreviewRoute[] } | undefined;

function routesFrom(raw: string): readonly BrowserPreviewRoute[] {
  if (cached?.raw === raw) return cached.routes;
  const value: unknown = JSON.parse(raw);
  if (
    !Array.isArray(value) ||
    !value.every(
      (route: unknown) =>
        typeof route === 'object' &&
        route !== null &&
        'origin' in route &&
        typeof route.origin === 'string' &&
        'prefix' in route &&
        typeof route.prefix === 'string'
    )
  )
    throw new Error('Invalid local preview endpoints; restart this worktree');
  const routes = value as BrowserPreviewRoute[];
  cached = { raw, routes };
  return routes;
}

/** Composition roots use the table Vite supplied for this boot, never a wall fallback. */
export function browserPreviewUrl(raw: string): string {
  const origin = browserPreviewOrigin();
  if (origin === null) return raw;
  const routes = (import.meta.env as { VITE_LOCAL_PREVIEW_ROUTES?: string })
    .VITE_LOCAL_PREVIEW_ROUTES;
  if (routes === undefined)
    throw new Error(
      'Local preview endpoints are missing; restart this worktree'
    );
  return resolveBrowserPreviewUrl(raw, origin, routesFrom(routes));
}

async function mappedRequest(
  input: Request,
  url: string,
  init: RequestInit | undefined
): Promise<Request> {
  const replaced = init?.body !== undefined && init.body !== null;
  const body =
    input.body === null || replaced ? undefined : await input.arrayBuffer();
  return new Request(url, {
    method: input.method,
    headers: input.headers,
    mode: input.mode,
    credentials: input.credentials,
    cache: input.cache,
    redirect: input.redirect,
    referrer: input.referrer,
    referrerPolicy: input.referrerPolicy,
    integrity: input.integrity,
    keepalive: input.keepalive,
    signal: input.signal,
    ...(body === undefined ? {} : { body }),
  });
}

export function resolveBrowserPreviewRequest(
  input: RequestInfo | URL,
  mapUrl: (url: string) => string,
  init?: RequestInit
): RequestInfo | URL | Promise<Request> {
  if (input instanceof Request) {
    const mapped = mapUrl(input.url);
    return mapped === input.url ? input : mappedRequest(input, mapped, init);
  }
  return mapUrl(String(input));
}

export function browserPreviewRequest(
  input: RequestInfo | URL,
  init?: RequestInit
): RequestInfo | URL | Promise<Request> {
  return resolveBrowserPreviewRequest(input, browserPreviewUrl, init);
}
