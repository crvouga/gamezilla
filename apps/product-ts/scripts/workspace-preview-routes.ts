import type { StackPlan } from './stack-plan';

export type PreviewRoute = {
  readonly prefix: string;
  readonly origin: string;
};

export function workspacePreviewRoutes(
  plan: StackPlan
): readonly PreviewRoute[] {
  const http = (port: number): string => `http://127.0.0.1:${String(port)}`;
  return [
    { prefix: '', origin: plan.apiOrigin },
    { prefix: '', origin: plan.webOrigin ?? '' },
    { prefix: '/_preview/google', origin: http(plan.ports.google) },
    { prefix: '/_preview/apple', origin: http(plan.ports.apple) },
    { prefix: '/_preview/billing', origin: http(plan.ports.billing) },
    {
      prefix: '/_preview/s3',
      origin: `http://localhost:${String(plan.ports.s3)}`,
    },
    {
      prefix: '/_preview/mqtt',
      origin: `ws://127.0.0.1:${String(plan.ports.mqttWs)}`,
    },
    {
      prefix: '/_preview/observability',
      origin: http(plan.ports.observability.collector),
    },
  ];
}

function atPath(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function previewProtocolBody(
  path: string,
  route: PreviewRoute
): boolean {
  return (
    ['/_preview/google', '/_preview/apple', '/_preview/billing'].includes(
      route.prefix
    ) ||
    (route.prefix === '' &&
      (atPath(path, '/api/auth') || atPath(path, '/auth')))
  );
}

export function previewRoute(
  path: string,
  routes: readonly PreviewRoute[]
): PreviewRoute | undefined {
  if (atPath(path, '/api') || atPath(path, '/auth')) return routes[0];
  return routes.find(
    (route) => route.prefix !== '' && atPath(path, route.prefix)
  );
}

function publicRouteOrigin(origin: string, route: PreviewRoute): string {
  const base = route.origin.startsWith('ws:')
    ? origin.replace(/^http/, 'ws')
    : origin;
  return `${base}${route.prefix}`;
}

function replaceUrlPrefix(
  text: string,
  source: string,
  target: string
): string {
  if (source === '') return text;
  let result = text;
  for (let depth = 0; depth <= 2; depth++) {
    const parts = result.split(source);
    result = parts[0] ?? '';
    for (const part of parts.slice(1)) {
      const boundary =
        part.length === 0 ||
        /^(?:[/?#\s"'<>),;]|%2[fF]|%3[fF]|%23|%25)/.test(part);
      result += `${boundary ? target : source}${part}`;
    }
    source = encodeURIComponent(source);
    target = encodeURIComponent(target);
  }
  return result;
}

/** Transform wire URLs only in the local preview, never in production data. */
export function rewritePreviewUrls(
  text: string,
  args: {
    readonly routes: readonly PreviewRoute[];
    readonly publicOrigin: string;
    readonly direction: 'outbound' | 'inbound';
  }
): string {
  if (args.direction === 'outbound') {
    const aliases = args.routes.flatMap((route) =>
      ['127.0.0.1', 'localhost', '[::1]'].map((host) => ({
        ...route,
        origin: route.origin.replace('127.0.0.1', host),
      }))
    );
    return aliases
      .sort((a, b) => b.origin.length - a.origin.length)
      .reduce(
        (value, route) =>
          replaceUrlPrefix(
            value,
            route.origin,
            publicRouteOrigin(args.publicOrigin, route)
          ),
        text
      );
  }
  let result = text;
  for (const route of args.routes.filter((route) => route.prefix !== '')) {
    result = replaceUrlPrefix(
      result,
      publicRouteOrigin(args.publicOrigin, route),
      route.origin
    );
  }
  const api = args.routes[0];
  const web = args.routes[1];
  if (api === undefined || web === undefined)
    throw new Error('Preview requires API and web routes');
  for (const path of ['/api', '/auth']) {
    result = replaceUrlPrefix(
      result,
      `${args.publicOrigin}${path}`,
      `${api.origin}${path}`
    );
  }
  return replaceUrlPrefix(result, args.publicOrigin, web.origin);
}

/** Mock-provider forms and scripts use root-relative paths on their own host. */
export function prefixPreviewHtml(html: string, prefix: string): string {
  if (prefix === '') return html;
  return html.replace(
    /(["'`])(\/(?!\/)[^"'`<>\s]*)\1/g,
    (_match, quote: string, path: string) => `${quote}${prefix}${path}${quote}`
  );
}
