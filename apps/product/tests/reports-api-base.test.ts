import { describe, expect, test } from 'bun:test';
import { reportsApiBase } from '@apps/product/reports-api-base';
import { DEFAULT_LOCAL_PREVIEW_API_ORIGIN } from '@libs/app-config-shared/local-preview-api-origin';

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

  // regression: reports-local-empty
  test('local stack reads the reports middleware while a deployed API keeps its origin', () => {
    expect(
      reportsApiBase({
        dev: true,
        pageOrigin: 'http://localhost:5264',
        configuredApi: 'http://127.0.0.1:64571',
      })
    ).toBe('http://localhost:5264');
    expect(
      reportsApiBase({
        dev: false,
        pageOrigin: 'https://dev.gamezilla.app',
        configuredApi: 'https://api-dev.gamezilla.app',
      })
    ).toBe('https://api-dev.gamezilla.app');
  });
});
