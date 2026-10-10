import { expect, test } from 'bun:test';
import { configKey, pathKey } from '@crvouga/atlas';

test('Atlas exports stable configuration identities for the product explorer', () => {
  // regression: atlas-config-key-export
  expect(configKey({ app: 'ready', sync: 'offline' })).toBe(
    configKey({ sync: 'offline', app: 'ready' })
  );
  expect(configKey('ready')).not.toBe(configKey({ app: 'ready' }));
  expect(
    pathKey(undefined, { value: 'ready', active: ['ready'] }, ['Open'])
  ).not.toBe(
    pathKey(undefined, { value: 'ready', active: ['ready'] }, ['Close'])
  );
});
