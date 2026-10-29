import { describe, expect, test } from 'bun:test';

import {
  profileNameForDomain,
  reportsDevEnv,
  reportsSecretsFromRecord,
} from './atlas-reports-credentials';

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
            name: 'acme@example.com',
            domain: 'https://app.infisical.com/api',
          },
          {
            name: 'acme@example.com--dead',
            domain: 'https://app.infisical.com/api',
          },
        ],
        'https://app.infisical.com'
      )
    ).toBe('acme@example.com');
    expect(profileNameForDomain([], 'https://app.infisical.com')).toBeNull();
  });

  test('only the reports read credential is kept', () => {
    expect(
      reportsSecretsFromRecord({
        REPORTS_BUCKET: ' acme-reports ',
        REPORTS_ENDPOINT: '',
        OTHER: 'nope',
      })
    ).toEqual({ REPORTS_BUCKET: 'acme-reports' });
  });

  test('a complete read credential is the provisioned bucket', () => {
    expect(
      reportsDevEnv(
        {
          REPORTS_BUCKET: ' acme-reports ',
          REPORTS_ENDPOINT: ' https://example.r2.cloudflarestorage.com ',
          REPORTS_ACCESS_KEY_ID: 'key',
          REPORTS_SECRET_ACCESS_KEY: 'secret',
          REPORTS_WRITE_ACCESS_KEY_ID: 'write-key',
        },
        'acme-reports'
      )
    ).toEqual({
      REPORTS_BUCKET: 'acme-reports',
      REPORTS_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
      REPORTS_ACCESS_KEY_ID: 'key',
      REPORTS_SECRET_ACCESS_KEY: 'secret',
    });
  });

  test('missing reports credentials do not block local stack startup', () => {
    // regression: local-stack-missing-reports-credentials
    expect(reportsDevEnv({}, 'acme-reports')).toEqual({
      REPORTS_BUCKET: '',
      REPORTS_ENDPOINT: '',
      REPORTS_ACCESS_KEY_ID: '',
      REPORTS_SECRET_ACCESS_KEY: '',
    });
  });

  test('partial credentials are cleared, including inherited bindings', () => {
    const inherited: Record<string, string> = {
      REPORTS_BUCKET: 'acme-reports',
      REPORTS_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
      REPORTS_ACCESS_KEY_ID: 'key',
      REPORTS_SECRET_ACCESS_KEY: 'secret',
    };
    expect({
      ...inherited,
      ...reportsDevEnv({ REPORTS_BUCKET: 'acme-reports' }, 'acme-reports'),
    }).toEqual(reportsDevEnv({}, 'acme-reports'));
  });

  test('credentials for another bucket leave reports unavailable', () => {
    expect(
      reportsDevEnv(
        {
          REPORTS_BUCKET: 'other-bucket',
          REPORTS_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
          REPORTS_ACCESS_KEY_ID: 'key',
          REPORTS_SECRET_ACCESS_KEY: 'secret',
        },
        'acme-reports'
      )
    ).toEqual(reportsDevEnv({}, 'acme-reports'));
  });
});
