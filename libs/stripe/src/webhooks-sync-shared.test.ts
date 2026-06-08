import { describe, expect, it } from 'bun:test';
import {
  decideWebhookSyncPlan,
  isLocalApiUrl,
  webhookEndpointsInSync,
  type WebhookEndpointSummary,
} from './webhooks-sync-shared';

const desired = 'https://www.gamezilla.app/stripe/webhook';

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
      {
        url: 'https://other.example/hook',
        enabled_events: ['*'],
        status: 'enabled',
      },
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

describe('isLocalApiUrl', () => {
  it('detects loopback IPv4 / IPv6 / localhost', () => {
    expect(isLocalApiUrl('http://127.0.0.1:8788')).toBe(true);
    expect(isLocalApiUrl('http://localhost:8788')).toBe(true);
    expect(isLocalApiUrl('http://[::1]:8788')).toBe(true);
    expect(isLocalApiUrl('http://api.localhost')).toBe(true);
    expect(isLocalApiUrl('http://api.local')).toBe(true);
  });

  it('detects RFC1918 / link-local private ranges', () => {
    expect(isLocalApiUrl('http://10.0.0.1')).toBe(true);
    expect(isLocalApiUrl('http://192.168.1.20')).toBe(true);
    expect(isLocalApiUrl('http://172.16.5.4')).toBe(true);
    expect(isLocalApiUrl('http://172.31.255.255')).toBe(true);
    expect(isLocalApiUrl('http://169.254.1.1')).toBe(true);
  });

  it('treats public origins as non-local', () => {
    expect(isLocalApiUrl('https://www.gamezilla.app')).toBe(false);
    expect(isLocalApiUrl('https://example.com')).toBe(false);
    expect(isLocalApiUrl('http://172.32.0.1')).toBe(false);
    expect(isLocalApiUrl('http://8.8.8.8')).toBe(false);
  });

  it('returns false for unparseable input', () => {
    expect(isLocalApiUrl('not a url')).toBe(false);
    expect(isLocalApiUrl('')).toBe(false);
  });
});
