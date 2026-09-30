import { describe, expect, test } from 'bun:test';

import {
  profileNameForDomain,
  reportsSecretsFromRecord,
} from './reports-dev-credentials';
import { isReportsApiPath } from './reports-dev-plugin';

describe('local reports dev', () => {
  test('the profile is the one whose Infisical domain matches the repo', () => {
    expect(
      profileNameForDomain(
        [
          {
            name: 'other@example.com',
            domain: 'https://secrets.example.com/api',
          },
          {
            name: 'gamezilla@example.com',
            domain: 'https://app.infisical.com/api',
          },
          {
            name: 'gamezilla@example.com--dead',
            domain: 'https://app.infisical.com/api',
          },
        ],
        'https://app.infisical.com'
      )
    ).toBe('gamezilla@example.com');
    expect(profileNameForDomain([], 'https://app.infisical.com')).toBeNull();
  });

  test('only the reports read credential is kept', () => {
    expect(
      reportsSecretsFromRecord({
        REPORTS_BUCKET: ' gamezilla-reports ',
        REPORTS_ENDPOINT: '',
        OTHER: 'nope',
      })
    ).toEqual({ REPORTS_BUCKET: 'gamezilla-reports' });
  });

  test('the dev server claims /api/reports and leaves every other path', () => {
    expect(isReportsApiPath('/api/reports')).toBe(true);
    expect(isReportsApiPath('/api/reports?cursor=abc')).toBe(true);
    expect(isReportsApiPath('/api/reports/abc/events')).toBe(true);
    expect(isReportsApiPath('/api/health')).toBe(false);
    expect(isReportsApiPath('/reports')).toBe(false);
  });
});
