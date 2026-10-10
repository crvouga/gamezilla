import { describe, expect, test } from 'bun:test';

import { localApiEnv } from './local-api-env';
import { isReportsApiPath } from './reports-dev-plugin';

describe('local reports dev', () => {
  test('missing cloud reports credentials cannot block local startup', () => {
    // regression: local-stack-missing-reports-credentials
    const empty = localApiEnv({});
    const cloud = localApiEnv({
      REPORTS_BUCKET: 'shared-cloud',
      REPORTS_ENDPOINT: 'https://outside.example',
      REPORTS_ACCESS_KEY_ID: 'key',
      REPORTS_SECRET_ACCESS_KEY: 'secret',
    });
    expect(empty).toEqual(cloud);
    expect(empty).not.toHaveProperty('REPORTS_ENDPOINT');
  });

  test('the dev server claims /api/reports and leaves every other path', () => {
    expect(isReportsApiPath('/api/reports')).toBe(true);
    expect(isReportsApiPath('/api/reports?cursor=abc')).toBe(true);
    expect(isReportsApiPath('/api/reports/abc/events')).toBe(true);
    expect(isReportsApiPath('/api/health')).toBe(false);
    expect(isReportsApiPath('/reports')).toBe(false);
  });
});
