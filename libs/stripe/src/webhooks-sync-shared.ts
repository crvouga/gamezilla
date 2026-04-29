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
