import { describe, expect, test } from 'bun:test';
import { DEFAULT_LOCAL_PREVIEW_API_ORIGIN } from '@libs/client-config/public/local-preview-api-origin';

import { reportsApiBase } from './reports-api-base';

describe('reports API base', () => {
  test('vite dev on the default wrangler preview reads the page origin', () => {
    expect(
      reportsApiBase({
        dev: true,
        pageOrigin: 'http://localhost:5264',
        configuredApi: DEFAULT_LOCAL_PREVIEW_API_ORIGIN,
      })
    ).toBe('http://localhost:5264');
  });

  test('a stack or deployed API stays the configured origin', () => {
    expect(
      reportsApiBase({
        dev: true,
        pageOrigin: 'http://localhost:5264',
        configuredApi: 'http://127.0.0.1:64571',
      })
    ).toBe('http://127.0.0.1:64571');
    expect(
      reportsApiBase({
        dev: false,
        pageOrigin: 'https://dev.gamezilla.app',
        configuredApi: 'https://api-dev.gamezilla.app',
      })
    ).toBe('https://api-dev.gamezilla.app');
  });
});
