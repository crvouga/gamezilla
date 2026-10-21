import { expect, test } from 'bun:test';

import {
  extractInlinedApiUrlFromBundleSource,
  productionClientApiOrigin,
} from '@libs/app-config-shared-ts/live-client-bundle-guard';

test('extractInlinedApiUrlFromBundleSource parses minified import.meta.env chunks', () => {
  const prod = productionClientApiOrigin();
  const good = `SSR:!1,VITE_API_URL:\`${prod}\`,VITE_COMMIT_DATE:\`2026-01-01\`;A.nonEmptyString(e,"VITE_API_URL is required`;
  expect(extractInlinedApiUrlFromBundleSource(good)).toBe(prod);

  const bad = `SSR:!1,VITE_API_URL:\`http://localhost:5173\`,VITE_COMMIT_DATE:\`x\`;A.nonEmptyString(e,"VITE_API_URL is required`;
  expect(extractInlinedApiUrlFromBundleSource(bad)).toBe(
    'http://localhost:5173'
  );

  expect(extractInlinedApiUrlFromBundleSource('no api url here')).toBeNull();
});
