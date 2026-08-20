/**
 * Playwright driver is used at fidelity max when `__PLAYWRIGHT_PAGE__` and
 * `PLAYWRIGHT_BASE_URL` are injected. Default CI `test:max` still uses RNTL
 * against prod-like adapters unless that origin is set.
 */

import { describe, expect, test } from '@jest/globals';

describe('playwright fidelity', () => {
  const enabled =
    process.env['PLAYWRIGHT_BASE_URL'] !== undefined &&
    process.env['PLAYWRIGHT_BASE_URL'].length > 0;

  const testFn = enabled ? test : test.skip;

  testFn('PLAYWRIGHT_BASE_URL is a http(s) origin', () => {
    const url = process.env['PLAYWRIGHT_BASE_URL'] ?? '';
    expect(url.startsWith('http://') || url.startsWith('https://')).toBe(true);
  });
});
