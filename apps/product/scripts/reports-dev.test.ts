import { describe, expect, test } from 'bun:test';

import {
  profileNameForDomain,
  reportsReadCredential,
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

  test('a complete read credential is the provisioned bucket', () => {
    expect(
      reportsReadCredential(
        {
          REPORTS_BUCKET: ' gamezilla-reports ',
          REPORTS_ENDPOINT: ' https://example.r2.cloudflarestorage.com ',
          REPORTS_ACCESS_KEY_ID: 'key',
          REPORTS_SECRET_ACCESS_KEY: 'secret',
          REPORTS_WRITE_ACCESS_KEY_ID: 'write-key',
        },
        'gamezilla-reports'
      )
    ).toEqual({
      REPORTS_BUCKET: 'gamezilla-reports',
      REPORTS_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
      REPORTS_ACCESS_KEY_ID: 'key',
      REPORTS_SECRET_ACCESS_KEY: 'secret',
    });
  });

  test('a read credential names every missing binding', () => {
    expect(() =>
      reportsReadCredential(
        { REPORTS_BUCKET: 'gamezilla-reports' },
        'gamezilla-reports'
      )
    ).toThrow(
      'REPORTS_ENDPOINT, REPORTS_ACCESS_KEY_ID, REPORTS_SECRET_ACCESS_KEY'
    );
  });

  test('a read credential has to be the provisioned bucket', () => {
    expect(() =>
      reportsReadCredential(
        {
          REPORTS_BUCKET: 'other-bucket',
          REPORTS_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
          REPORTS_ACCESS_KEY_ID: 'key',
          REPORTS_SECRET_ACCESS_KEY: 'secret',
        },
        'gamezilla-reports'
      )
    ).toThrow('provisioned reports bucket gamezilla-reports');
  });

  test('the dev server claims /api/reports and leaves every other path', () => {
    expect(isReportsApiPath('/api/reports')).toBe(true);
    expect(isReportsApiPath('/api/reports?cursor=abc')).toBe(true);
    expect(isReportsApiPath('/api/reports/abc/events')).toBe(true);
    expect(isReportsApiPath('/api/health')).toBe(false);
    expect(isReportsApiPath('/reports')).toBe(false);
  });
});
