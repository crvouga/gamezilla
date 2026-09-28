/** Semantic delivery class — stable if transports change. */
export type HarnessTraffic = 'live' | 'sync' | 'all';

export type ClientTraffic = Exclude<HarnessTraffic, 'all'>;

const HTTP_PREFIX = 'http:';
const PUBSUB_PREFIX = 'pubsub:';
const SERVER_HTTP = 'http:server';
const SERVER_NODE_PREFIX = 'server:';
const BROKER = 'pubsub:broker';
const SERVER_PUB = 'pubsub:server';

/** Client node + traffic for an endpoint, or null for infrastructure. */
export function classifyEndpoint(
  id: string
): { readonly nodeId: string; readonly traffic: ClientTraffic } | null {
  if (id.startsWith(HTTP_PREFIX) && id !== SERVER_HTTP) {
    return { nodeId: id.slice(HTTP_PREFIX.length), traffic: 'sync' };
  }
  if (id.startsWith(PUBSUB_PREFIX) && id !== BROKER && id !== SERVER_PUB) {
    return { nodeId: id.slice(PUBSUB_PREFIX.length), traffic: 'live' };
  }
  return null;
}

/** Client involved in a hop (prefer `from`, else `to`). */
export function clientForHop(
  from: string,
  to: string
): { readonly nodeId: string; readonly traffic: ClientTraffic } | null {
  return classifyEndpoint(from) ?? classifyEndpoint(to);
}

export function matchesTraffic(
  held: HarnessTraffic,
  actual: ClientTraffic
): boolean {
  return held === 'all' || held === actual;
}

export function syncEndpoint(nodeId: string): string {
  return `${HTTP_PREFIX}${nodeId}`;
}

export function liveEndpoint(nodeId: string): string {
  return `${PUBSUB_PREFIX}${nodeId}`;
}

export function serverNodeEndpoint(nodeId: string): string {
  return `${SERVER_NODE_PREFIX}${nodeId}`;
}

export { BROKER, SERVER_HTTP, SERVER_PUB };
