/**
 * Which kind of traffic an API request is, by the route that answered it.
 *
 * Every finished request is counted with its route group, so an objective
 * about what people experience can leave out the traffic machines make
 * (health probes, the synthetic population worker, telemetry uploads), which
 * is most of the requests the API answers.
 *
 * The group comes from the route pattern (`/api/mutations`), never the URL,
 * so it is a short closed list however many ids a path carries. A route that
 * no rule names falls into {@link DEFAULT_ROUTE_GROUP}, which counts as
 * people's traffic: a new route is measured against the objectives until
 * someone says otherwise, and a test fails until it has a rule of its own.
 */

export const ROUTE_GROUPS = [
  /** Reading and writing the person's data: queries and mutations. */
  'sync',
  /** Who the person is and how their device stays connected. */
  'session',
  /** Joining and playing in a live room. */
  'room',
  /** Paying and managing a subscription. */
  'billing',
  /** Generated speech and text: slow by nature, so not judged for speed. */
  'media',
  /** Any other thing a person or an operator asks of the app. */
  'app',
  /** Telemetry the browser uploads. People do not wait for it. */
  'telemetry',
  /** Machines: health probes and the synthetic population worker. */
  'machine',
] as const;
export type RouteGroup = (typeof ROUTE_GROUPS)[number];

/** Where a route no rule names is counted: as people's traffic. */
export const DEFAULT_ROUTE_GROUP: RouteGroup = 'app';

/** Traffic people cause and wait on: what availability objectives judge. */
export const PEOPLE_ROUTE_GROUPS = [
  'sync',
  'session',
  'room',
  'billing',
  'media',
  'app',
] as const satisfies readonly RouteGroup[];

/** People's traffic that should answer quickly: what speed objectives judge. */
export const INTERACTIVE_ROUTE_GROUPS = [
  'sync',
  'session',
  'room',
  'billing',
  'app',
] as const satisfies readonly RouteGroup[];

export type RouteRule = {
  /** Whole path segments the route pattern starts with. */
  readonly prefix: string;
  readonly group: RouteGroup;
};

/**
 * Every route family the API mounts, with the group it belongs to. The
 * longest matching prefix wins. A family that is a person's own business may
 * be named `app` explicitly: naming it says someone decided.
 */
export const ROUTE_RULES: readonly RouteRule[] = [
  { prefix: '/api/query', group: 'sync' },
  { prefix: '/api/mutations', group: 'sync' },
  { prefix: '/api/auth', group: 'session' },
  { prefix: '/api/identity', group: 'session' },
  { prefix: '/api/pubsub', group: 'session' },
  { prefix: '/api/room', group: 'room' },
  { prefix: '/api/billing', group: 'billing' },
  { prefix: '/api/tts', group: 'media' },
  { prefix: '/api/llm', group: 'media' },
  { prefix: '/api/notifications', group: 'app' },
  { prefix: '/api/puzzle-management', group: 'app' },
  { prefix: '/api/admin', group: 'app' },
  { prefix: '/api/observability', group: 'telemetry' },
  { prefix: '/api/health', group: 'machine' },
  { prefix: '/api/synthetic-population-worker', group: 'machine' },
];

function segments(path: string): readonly string[] {
  return path.split('/').filter((segment) => segment !== '');
}

/** The group a rule names for this route pattern, or `null` when none does. */
export function explicitRouteGroup(routePattern: string): RouteGroup | null {
  const route = segments(routePattern);
  let best: { readonly length: number; readonly group: RouteGroup } | null =
    null;
  for (const rule of ROUTE_RULES) {
    const prefix = segments(rule.prefix);
    const matches = prefix.every((segment, i) => route[i] === segment);
    if (matches && (best === null || prefix.length > best.length)) {
      best = { length: prefix.length, group: rule.group };
    }
  }
  return best?.group ?? null;
}

/** The group a request to this route pattern is counted in. */
export function routeGroupOf(routePattern: string): RouteGroup {
  return explicitRouteGroup(routePattern) ?? DEFAULT_ROUTE_GROUP;
}
