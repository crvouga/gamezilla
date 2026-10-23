/**
 * Stripe's webhook deliveries from a harness payment provider to the app.
 *
 * Every event the provider records goes to every webhook endpoint its account
 * registered through the API (`POST /v1/webhook_endpoints` — the app's own
 * offer reconcile creates it), signed `Stripe-Signature` with that endpoint's
 * secret, one at a time in the order they happened. A delivery the app does
 * not accept (a non-2xx answer, a partition) is retried with backoff, as
 * Stripe retries.
 *
 * The provider's own delivery hub signs with the wall clock and retries on
 * real timers, so a virtual-time harness delivers here instead, on the
 * harness clock and timers
 * (https://github.com/crvouga/mockingbird/issues/160).
 */

import type { StripeWebhookEvent } from '@crvouga/mockingbird-service-stripe';
import type { ServerHttp } from '@libs/sub-shared-ts/sync';
import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import Stripe from 'stripe';

/** Backoff after each failed attempt; after the last the delivery is dropped. */
const DELIVERY_BACKOFF_MS = [
  1000, 5000, 30_000, 120_000, 600_000, 3_600_000,
] as const;

/** An endpoint an account registered through the API. */
export type StripeWebhookEndpoint = {
  readonly account: string;
  readonly url: string;
  readonly secret: string;
  readonly events: readonly string[];
};

type Delivery = {
  readonly event: StripeWebhookEvent;
  readonly endpoint: StripeWebhookEndpoint;
  attempts: number;
  dueAtMs: number;
};

export type StripeWebhookRelay = {
  /** Queue `event` for every endpoint subscribed to it. */
  publish(event: StripeWebhookEvent): void;
  /** Deliver an event again, exactly as it was sent (a replay). */
  resend(eventId: string): void;
  dispose(): void;
};

function subscribed(
  endpoint: StripeWebhookEndpoint,
  event: StripeWebhookEvent
): boolean {
  return (
    endpoint.account === event.account &&
    (endpoint.events.includes('*') || endpoint.events.includes(event.type))
  );
}

export function createStripeWebhookRelay(deps: {
  readonly endpoints: () => readonly StripeWebhookEndpoint[];
  /** The provider's route to the app (the load balancer, from its node). */
  readonly send: ServerHttp;
  readonly clock: Clock;
  readonly timers: Timers;
}): StripeWebhookRelay {
  const sent = new Map<string, StripeWebhookEvent>();
  const queue: Delivery[] = [];
  let wake: unknown = null;
  let draining = false;

  const attempt = async (delivery: Delivery): Promise<boolean> => {
    const header = await Stripe.webhooks.generateTestHeaderStringAsync({
      payload: delivery.event.body,
      secret: delivery.endpoint.secret,
      timestamp: Math.floor(deps.clock.now() / 1000),
    });
    try {
      const response = await deps.send(delivery.endpoint.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': header,
        },
        body: delivery.event.body,
      });
      await response.body?.cancel();
      return response.ok;
    } catch {
      return false;
    }
  };

  const schedule = (): void => {
    if (wake !== null) deps.timers.clearTimeout(wake);
    wake = null;
    const next = queue[0];
    if (next === undefined) return;
    wake = deps.timers.setTimeout(
      () => {
        wake = null;
        void drain();
      },
      Math.max(0, next.dueAtMs - deps.clock.now())
    );
  };

  /** Oldest first; a failed delivery holds the ones behind it until it lands. */
  const drain = async (): Promise<void> => {
    if (draining) return;
    draining = true;
    try {
      for (;;) {
        const head = queue[0];
        if (head === undefined || head.dueAtMs > deps.clock.now()) break;
        if (await attempt(head)) {
          queue.shift();
          continue;
        }
        head.attempts += 1;
        const backoff = DELIVERY_BACKOFF_MS[head.attempts - 1];
        if (backoff === undefined) {
          queue.shift();
          continue;
        }
        head.dueAtMs = deps.clock.now() + backoff;
        break;
      }
    } finally {
      draining = false;
      schedule();
    }
  };

  const enqueue = (event: StripeWebhookEvent): void => {
    for (const endpoint of deps.endpoints()) {
      if (!subscribed(endpoint, event)) continue;
      queue.push({ event, endpoint, attempts: 0, dueAtMs: deps.clock.now() });
    }
    // Never inside the provider's own request: it has not answered yet.
    if (!draining) schedule();
  };

  return {
    publish(event) {
      sent.set(event.id, event);
      enqueue(event);
    },
    resend(eventId) {
      const event = sent.get(eventId);
      if (event === undefined) {
        throw new Error(`billing: no webhook event ${eventId} was sent`);
      }
      enqueue(event);
    },
    dispose() {
      if (wake !== null) deps.timers.clearTimeout(wake);
      wake = null;
      queue.length = 0;
    },
  };
}
