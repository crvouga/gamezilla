import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';

import {
  assertNonProdDatabaseUrl,
  assertNonProductionSecretsEnv,
  normalizeDatabaseUrlForCompare,
  productionDatabaseUrlTigerExceptionEnabled,
} from '@pkgs/database-url-policy-shared-ts/database-url-policy';

function registerThrowingCrashHandlerForTests(): () => void {
  return assert.registerCrashHandler({
    priority: 5,
    match: () => true,
    crash(message, context) {
      const err = new Error(message);
      Object.assign(err, { context });
      throw err;
    },
  });
}

let disposeCrash: () => void;
beforeAll(() => {
  disposeCrash = registerThrowingCrashHandlerForTests();
});
afterAll(() => {
  disposeCrash();
});

const DEV_URL =
  'postgres://dev_user:secret@dev-host.example.com:5432/postgres?sslmode=require';
const PROD_URL =
  'postgres://prod_user:other@prod-host.example.com:5432/postgres?sslmode=require';
const LOOPBACK_URL =
  'postgres://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable';

describe('normalizeDatabaseUrlForCompare', () => {
  test('strips username and password', () => {
    const a = normalizeDatabaseUrlForCompare(
      'postgres://user:pass@host.example.com:5432/db'
    );
    const b = normalizeDatabaseUrlForCompare(
      'postgres://other:secret@host.example.com:5432/db'
    );
    expect(a).toBe(b);
    expect(a).toContain('host.example.com');
    expect(a).not.toContain('pass');
  });
});

describe('assertNonProductionSecretsEnv', () => {
  const PRODUCTION = ['live', 'live-eu'] as const;

  test('accepts any environment the caller does not call production', () => {
    for (const env of ['dev', 'staging', 'preview-42']) {
      expect(() =>
        assertNonProductionSecretsEnv(env, PRODUCTION)
      ).not.toThrow();
    }
  });

  test('rejects every production environment', () => {
    for (const env of PRODUCTION) {
      expect(() => assertNonProductionSecretsEnv(env, PRODUCTION)).toThrow(
        /non-production secrets env/
      );
    }
  });

  test('rejects empty', () => {
    expect(() => assertNonProductionSecretsEnv('', PRODUCTION)).toThrow(
      /non-production secrets env/
    );
  });
});

describe('assertNonProdDatabaseUrl', () => {
  test('allows distinct dev URL when prod reference differs', async () => {
    await expect(
      assertNonProdDatabaseUrl(DEV_URL, {}, { productionUrls: [PROD_URL] })
    ).resolves.toBeUndefined();
  });

  test('blocks URL equal to prod reference', async () => {
    await expect(
      assertNonProdDatabaseUrl(PROD_URL, {}, { productionUrls: [PROD_URL] })
    ).rejects.toThrow(/matches a production/);
  });

  test('blocks URL equal to any of several production references', async () => {
    const OTHER_PROD =
      'postgres://u:p@prod-eu.example.com:5432/postgres?sslmode=require';
    await expect(
      assertNonProdDatabaseUrl(
        OTHER_PROD,
        {},
        { productionUrls: [PROD_URL, OTHER_PROD] }
      )
    ).rejects.toThrow(/matches a production/);
  });

  test('allows loopback (@pkgs/postgres-mockingbird-server-ts)', async () => {
    await expect(
      assertNonProdDatabaseUrl(LOOPBACK_URL, {}, { productionUrls: [PROD_URL] })
    ).resolves.toBeUndefined();
  });

  test('escape hatch still skips remaining checks', async () => {
    const prev = process.env['ALLOW_PRODUCTION_DATABASE_URL'];
    process.env['ALLOW_PRODUCTION_DATABASE_URL'] = '1';
    try {
      expect(productionDatabaseUrlTigerExceptionEnabled()).toBe(true);
      await expect(
        assertNonProdDatabaseUrl(PROD_URL, {}, { productionUrls: [PROD_URL] })
      ).resolves.toBeUndefined();
    } finally {
      if (prev === undefined) {
        delete process.env['ALLOW_PRODUCTION_DATABASE_URL'];
      } else {
        process.env['ALLOW_PRODUCTION_DATABASE_URL'] = prev;
      }
    }
  });
});
