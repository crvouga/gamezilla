/**
 * Pure helpers for Stripe webhook endpoint reconciliation (unit-tested).
 */

export type WebhookEndpointSummary = {
  readonly url: string;
  readonly enabled_events: readonly string[];
  readonly status: string;
};

export function normalizeEnabledEvents(events: readonly string[]): string[] {
  return [...events].map((e) => e.trim()).sort();
}

/** True when exactly one enabled endpoint matches URL and subscribes to all events (`*`). */
export function webhookEndpointsInSync(
  endpoints: ReadonlyArray<WebhookEndpointSummary>,
  desiredUrl: string
): boolean {
  if (endpoints.length !== 1) return false;
  const e = endpoints[0];
  if (e === undefined) return false;
  if (e.url !== desiredUrl) return false;
  if (e.status !== 'enabled') return false;
  const ev = normalizeEnabledEvents(e.enabled_events);
  return ev.length === 1 && ev[0] === '*';
}

export type WebhookSyncPlan = 'noop' | 'rebuild';

export function decideWebhookSyncPlan(
  endpoints: ReadonlyArray<WebhookEndpointSummary>,
  desiredUrl: string
): WebhookSyncPlan {
  return webhookEndpointsInSync(endpoints, desiredUrl) ? 'noop' : 'rebuild';
}

function classifyPrivateIpv4Octets(a: number, b: number): boolean {
  if (a === 127 || a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function isPrivateIpv4(host: string): boolean {
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4 === null) return false;
  return classifyPrivateIpv4Octets(Number(v4[1]), Number(v4[2]));
}

/**
 * True when `apiUrlBase` is not reachable from Stripe's webhook system —
 * loopback (`127.0.0.1`, `::1`), `localhost`, `*.local`/`*.localhost`, or
 * RFC1918 private ranges. Stripe's `webhookEndpoints.create` rejects these
 * with `Invalid URL: URL must be publicly accessible`, so the sync script
 * skips the webhook step locally and tells the operator to use `stripe listen`.
 */
export function isLocalApiUrl(apiUrlBase: string): boolean {
  let host: string;
  try {
    host = new URL(apiUrlBase).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (host === 'localhost' || host === '::1' || host === '[::1]') return true;
  if (host.endsWith('.localhost') || host.endsWith('.local')) return true;
  return isPrivateIpv4(host);
}
