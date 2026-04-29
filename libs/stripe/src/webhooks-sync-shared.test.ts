import { describe, expect, it } from 'bun:test';
import {
  decideWebhookSyncPlan,
  webhookEndpointsInSync,
  type WebhookEndpointSummary,
} from './webhooks-sync-shared';

const desired = 'https://api.gamezilla.app/stripe/webhook';

describe('webhookEndpointsInSync', () => {
  it('is true for single enabled * endpoint at desired URL', () => {
    const eps: WebhookEndpointSummary[] = [
      { url: desired, enabled_events: ['*'], status: 'enabled' },
    ];
    expect(webhookEndpointsInSync(eps, desired)).toBe(true);
  });

  it('is false when count !== 1', () => {
    expect(webhookEndpointsInSync([], desired)).toBe(false);
    const two: WebhookEndpointSummary[] = [
      { url: desired, enabled_events: ['*'], status: 'enabled' },
      { url: 'https://other.example/hook', enabled_events: ['*'], status: 'enabled' },
    ];
    expect(webhookEndpointsInSync(two, desired)).toBe(false);
  });

  it('is false when URL mismatches', () => {
    const eps: WebhookEndpointSummary[] = [
      {
        url: 'https://wrong.example/stripe/webhook',
        enabled_events: ['*'],
        status: 'enabled',
      },
    ];
    expect(webhookEndpointsInSync(eps, desired)).toBe(false);
  });

  it('is false when events are not exactly *', () => {
    const eps: WebhookEndpointSummary[] = [
      {
        url: desired,
        enabled_events: ['customer.created'],
        status: 'enabled',
      },
    ];
    expect(webhookEndpointsInSync(eps, desired)).toBe(false);
  });
});

describe('decideWebhookSyncPlan', () => {
  it('returns noop when in sync', () => {
    const eps: WebhookEndpointSummary[] = [
      { url: desired, enabled_events: ['*'], status: 'enabled' },
    ];
    expect(decideWebhookSyncPlan(eps, desired)).toBe('noop');
  });

  it('returns rebuild when drifted', () => {
    expect(decideWebhookSyncPlan([], desired)).toBe('rebuild');
  });
});
