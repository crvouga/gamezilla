import { expect, test } from 'bun:test';

import {
  extractInlinedApiUrlFromBundleSource,
  productionClientApiOrigin,
} from '@libs/client-config/public/production-client-bundle-guard';

test('extractInlinedApiUrlFromBundleSource parses minified getApiBaseUrl chunks', () => {
  const prod = productionClientApiOrigin();
  const good = `const t="${prod}";o.assert.nonEmptyString(t,'EXPO_PUBLIC_API_URL is required`;
  expect(extractInlinedApiUrlFromBundleSource(good)).toBe(prod);

  const bad = `const t="http://localhost:5173";o.assert.nonEmptyString(t,'EXPO_PUBLIC_API_URL is required`;
  expect(extractInlinedApiUrlFromBundleSource(bad)).toBe(
    'http://localhost:5173'
  );

  expect(extractInlinedApiUrlFromBundleSource('no api url here')).toBeNull();

  const hermesStub = `EXPO_PUBLIC_API_URL is required\x00${prod}\x00`;
  expect(extractInlinedApiUrlFromBundleSource(hermesStub)).toBe(prod);
});
