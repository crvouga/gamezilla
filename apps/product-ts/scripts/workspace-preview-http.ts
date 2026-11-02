import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import {
  type PreviewRoute,
  prefixPreviewHtml,
  previewProtocolBody,
  previewRoute,
  rewritePreviewUrls,
} from './workspace-preview-routes';

const BODY_TYPES =
  /(?:json|text\/html|text\/plain|javascript|x-www-form-urlencoded)/;
const OMIT_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'content-encoding',
]);

type PreviewHttpOptions = {
  readonly routes: readonly PreviewRoute[];
  readonly publicOrigin: string;
  readonly http: HttpClient;
};

function rewrite(
  value: string,
  options: PreviewHttpOptions,
  direction: 'outbound' | 'inbound'
): string {
  return rewritePreviewUrls(value, { ...options, direction });
}

function headersFor(
  source: Headers,
  options: PreviewHttpOptions,
  direction: 'outbound' | 'inbound'
): Headers {
  const headers = new Headers();
  for (const [name, value] of source) {
    if (direction === 'inbound' && name.startsWith('cf-access-')) continue;
    if (name === 'cookie') {
      const cookies = value
        .split(';')
        .map((cookie) => cookie.trim())
        .filter((cookie) => !cookie.startsWith('CF_Authorization='));
      if (cookies.length > 0) headers.set(name, cookies.join('; '));
      continue;
    }
    if (
      (!OMIT_HEADERS.has(name) ||
        (name === 'content-encoding' && direction === 'inbound')) &&
      name !== 'set-cookie'
    )
      headers.set(name, rewrite(value, options, direction));
  }
  return headers;
}

function rewriteCookie(
  cookie: string,
  route: PreviewRoute,
  options: PreviewHttpOptions
): string {
  let value = cookie.replace(/;\s*Domain=[^;]+/gi, '');
  if (
    options.publicOrigin.startsWith('https:') &&
    !/;\s*Secure(?:;|$)/i.test(value)
  )
    value += '; Secure';
  if (route.prefix === '') return value;
  return /;\s*Path=/i.test(value)
    ? value.replace(/(;\s*Path=)(\/[^;]*)/i, `$1${route.prefix}$2`)
    : `${value}; Path=${route.prefix}/`;
}

async function requestBody(
  request: Request,
  options: PreviewHttpOptions,
  protocol: boolean
): Promise<ArrayBuffer | string | undefined> {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  return protocol && BODY_TYPES.test(request.headers.get('content-type') ?? '')
    ? rewrite(await request.text(), options, 'inbound')
    : request.arrayBuffer();
}

async function responseBody(
  response: Response,
  route: PreviewRoute,
  options: PreviewHttpOptions,
  protocol: boolean
): Promise<BodyInit | null> {
  const type = response.headers.get('content-type') ?? '';
  if (!protocol || !BODY_TYPES.test(type)) return response.body;
  const text = rewrite(await response.text(), options, 'outbound');
  return type.includes('text/html')
    ? prefixPreviewHtml(text, route.prefix)
    : text;
}

/** Only declared local services are reachable; there is no arbitrary-port proxy. */
export async function workspacePreviewResponse(
  request: Request,
  options: PreviewHttpOptions
): Promise<Response | null> {
  const url = new URL(request.url);
  const route = previewRoute(url.pathname, options.routes);
  if (route === undefined)
    return url.pathname.startsWith('/_preview/')
      ? new Response('Unknown preview service', { status: 404 })
      : null;
  if (route.origin.startsWith('ws:'))
    return new Response('WebSocket upgrade required', { status: 426 });
  const protocol = previewProtocolBody(url.pathname, route);
  const encoding = request.headers.get('content-encoding');
  if (protocol && encoding !== null && encoding !== 'identity')
    return new Response(
      'Local preview requires uncompressed authentication payloads',
      { status: 415 }
    );
  const target = new URL(
    `${url.pathname.slice(route.prefix.length)}${protocol ? rewrite(url.search, options, 'inbound') : url.search}`,
    route.origin
  );
  const headers = headersFor(request.headers, options, 'inbound');
  if (
    protocol &&
    route.prefix !== '' &&
    request.headers.get('origin') === options.publicOrigin
  )
    headers.set('origin', route.origin);
  headers.set('accept-encoding', 'identity');
  const body = await requestBody(request, options, protocol);
  const upstream = await options.http.fetch(target, {
    method: request.method,
    headers,
    redirect: 'manual',
    signal: request.signal,
    ...(body === undefined ? {} : { body }),
  });
  const outgoing = headersFor(upstream.headers, options, 'outbound');
  if (protocol) outgoing.delete('etag');
  const location = upstream.headers.get('location');
  if (location?.startsWith('/') && !location.startsWith('//'))
    outgoing.set('location', `${route.prefix}${location}`);
  for (const cookie of upstream.headers.getSetCookie())
    outgoing.append('set-cookie', rewriteCookie(cookie, route, options));
  outgoing.set('cache-control', 'no-store');
  const noBody =
    request.method === 'HEAD' || [204, 205, 304].includes(upstream.status);
  return new Response(
    noBody ? null : await responseBody(upstream, route, options, protocol),
    { status: upstream.status, headers: outgoing }
  );
}
