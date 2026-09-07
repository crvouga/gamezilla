import { expect, test } from 'bun:test';

import {
  extractInlinedApiUrlFromBundleSource,
  productionClientApiOrigin,
} from '@libs/client-config/public/production-client-bundle-guard';

test('extractInlinedApiUrlFromBundleSource parses minified getServerBaseUrl chunks', () => {
  const prod = productionClientApiOrigin();
  const good = `const t="${prod}";o.assert.nonEmptyString(t,'VITE_API_URL is required`;
  expect(extractInlinedApiUrlFromBundleSource(good)).toBe(prod);

  const bad = `const t="http://localhost:5173";o.assert.nonEmptyString(t,'VITE_API_URL is required`;
  expect(extractInlinedApiUrlFromBundleSource(bad)).toBe(
    'http://localhost:5173'
  );

  expect(extractInlinedApiUrlFromBundleSource('no api url here')).toBeNull();
});
