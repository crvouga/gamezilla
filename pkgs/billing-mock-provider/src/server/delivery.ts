/**
 * Webhook delivery. Events are sent after the change that raised them
 * commits, oldest first, each signed at send time. A non-2xx answer or a
 * network failure is retried with backoff, as a real provider does — which
 * is also how a callback that raced ahead of the app's own write, or landed
 * during a partition, still arrives.
 */
import { signMockBillingPayload } from '@pkgs/billing-mock/signature';
import {
  MOCK_BILLING_SIGNATURE_HEADER,
  type MockEvent,
} from '@pkgs/billing-mock/wire';
import type { Clock, Timers } from '@pkgs/clock';
import type { Logger } from '@pkgs/logger';

import type { ProviderStore } from './store';

/** Where events go: one endpoint, one signing secret. */
export type WebhookEndpoint = {
  readonly url: string;
  readonly secret: string;
};

export type ProviderFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

/** Backoff after each failed attempt; after the last the event is dropped. */
export const DELIVERY_BACKOFF_MS = [
  1000, 5000, 30_000, 120_000, 600_000, 3_600_000,
] as const;

export class WebhookDelivery {
  private draining: Promise<void> | null = null;
  private wake: unknown = null;
  private again = false;

  constructor(
    private readonly deps: {
      readonly store: ProviderStore;
      readonly endpoint: WebhookEndpoint | null;
      readonly fetch: ProviderFetch;
      readonly clock: Clock;
      readonly timers: Timers;
      readonly logger: Logger;
    }
  ) {}

  /** Deliver what is due, soon — never inside the caller's own request. */
  kick(): void {
    if (this.deps.endpoint === null) return;
    this.schedule(0);
  }

  /** Resolves once every delivery currently due has been attempted. */
  async flush(): Promise<void> {
    await this.drain();
  }

  private schedule(delayMs: number): void {
    if (this.wake !== null) this.deps.timers.clearTimeout(this.wake);
    this.wake = this.deps.timers.setTimeout(() => {
      this.wake = null;
      void this.drain();
    }, delayMs);
  }

  private async drain(): Promise<void> {
    if (this.draining !== null) {
      this.again = true;
      return await this.draining;
    }
    this.draining = this.deliverDue();
    try {
      await this.draining;
    } finally {
      this.draining = null;
    }
    if (this.again) {
      this.again = false;
      await this.drain();
    }
  }

  private async deliverDue(): Promise<void> {
    const endpoint = this.deps.endpoint;
    if (endpoint === null) return;
    const due = await this.deps.store.tx((db) =>
      db.dueEvents(this.deps.clock.now())
    );
    for (const pending of due) {
      const ok = await this.send(endpoint, pending.event);
      const attempts = pending.attempts + 1;
      const backoff = DELIVERY_BACKOFF_MS[attempts - 1];
      await this.deps.store.tx((db) =>
        db.recordAttempt({
          id: pending.event.id,
          delivery: ok
            ? 'delivered'
            : backoff === undefined
              ? 'failed'
              : 'pending',
          attempts,
          nextAttemptMs: this.deps.clock.now() + (backoff ?? 0),
        })
      );
    }
    const next = await this.deps.store.tx((db) => db.nextAttemptMs());
    if (next !== null) {
      this.schedule(Math.max(0, next - this.deps.clock.now()));
    }
  }

  private async send(
    endpoint: WebhookEndpoint,
    event: MockEvent
  ): Promise<boolean> {
    const payload = JSON.stringify(event);
    try {
      const response = await this.deps.fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [MOCK_BILLING_SIGNATURE_HEADER]: signMockBillingPayload({
            secret: endpoint.secret,
            payload,
            timestampS: Math.floor(this.deps.clock.now() / 1000),
          }),
        },
        body: payload,
      });
      await response.body?.cancel();
      if (!response.ok) {
        this.deps.logger.warn('billing mock: webhook rejected', {
          event: event.id,
          type: event.type,
          status: response.status,
        });
      }
      return response.ok;
    } catch (error) {
      this.deps.logger.warn('billing mock: webhook unreachable', {
        event: event.id,
        type: event.type,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
