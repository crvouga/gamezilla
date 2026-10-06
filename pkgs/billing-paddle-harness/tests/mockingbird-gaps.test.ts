import { expect, test } from 'bun:test';
import { createRuntime } from '@crvouga/mockingbird-service-paddle';
import { PaddleApi } from '@pkgs/billing-paddle-shared/paddle-api';
import type {
  PaddleCustomer,
  PaddleNotificationSetting,
  PaddlePortalSession,
} from '@pkgs/billing-paddle-shared/wire';

function open() {
  const runtime = createRuntime();
  return new PaddleApi({
    apiKey: 'pdl_sdbx_apikey_fixture',
    origin: 'http://paddle.mock',
    fetch: (input, init) => runtime.fetch(new Request(input, init)),
  });
}

// regression: mockingbird-paddle-portal-sessions
test('the production Paddle client creates a customer portal session', async () => {
  const api = open();
  const customer = await api.data<PaddleCustomer>('POST', '/customers', {
    email: 'fixture@example.com',
  });
  const portal = await api.data<PaddlePortalSession>(
    'POST',
    `/customers/${customer.id}/portal-sessions`,
    {}
  );
  expect(new URL(portal.urls.general.overview).protocol).toBe('https:');
});

// regression: mockingbird-paddle-notification-settings
test('Paddle notification settings can be reconciled through the vendor API', async () => {
  const api = open();
  expect(
    await api.data<readonly PaddleNotificationSetting[]>(
      'GET',
      '/notification-settings'
    )
  ).toEqual([]);
  const created = await api.data<PaddleNotificationSetting>(
    'POST',
    '/notification-settings',
    {
      description: 'Example webhook',
      destination: 'https://example.com/callback',
      type: 'url',
      active: true,
      subscribed_events: ['subscription.updated'],
    }
  );
  expect(created.endpoint_secret_key).toBeString();
  await api.data('PATCH', `/notification-settings/${created.id}`, {
    destination: 'https://example.com/new-callback',
  });
  const settings = await api.data<readonly PaddleNotificationSetting[]>(
    'GET',
    '/notification-settings'
  );
  expect(settings).toHaveLength(1);
  expect(settings[0]?.destination).toBe('https://example.com/new-callback');
});
