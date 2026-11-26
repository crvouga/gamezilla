import { expect, test } from 'bun:test';
import {
  clientConfig,
  productClientConfig,
} from '@libs/app-config-shared-ts/client-config-query';
import { CLIENT_CONFIG_TOPIC_MAP } from '@libs/app-config-shared-ts/topic-map';

test('policy sync and shared change notifications keep current and past admin rosters private', async () => {
  const roles = {
    admin: {
      when: { accountId: ['current-reader', 'another-account'] },
      permissions: ['admin:access'],
    },
  };
  const row = {
    id: 'permission_policy',
    value: JSON.stringify({ roles, history: [{ roles }] }),
    deleted_at: null,
  };
  const ctx = {
    db: { query: async () => [row] },
    env: {
      actorId: 'current-reader',
      accountId: 'current-reader',
      isAnon: false,
      deviceId: 'device',
      now: () => new Date(0),
    },
  };
  const product = JSON.stringify(await productClientConfig.run(ctx, {}));
  const admin = JSON.stringify(await clientConfig.run(ctx, {}));
  expect(product).not.toContain('current-reader');
  expect(product).not.toContain('another-account');
  expect(admin).toContain('current-reader');
  expect(admin).not.toContain('another-account');
  expect(CLIENT_CONFIG_TOPIC_MAP.client_config.rowImage.publish(row)).toBe(
    false
  );
});
