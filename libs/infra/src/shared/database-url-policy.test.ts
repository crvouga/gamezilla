import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { assert } from '@pkgs/assert';

import {
  assertDevSecretsEnv,
  assertNonProdDatabaseUrl,
  normalizeDatabaseUrlForCompare,
  productionDatabaseUrlTigerExceptionEnabled,
} from './database-url-policy';

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

describe('assertDevSecretsEnv', () => {
  test('accepts dev', () => {
    expect(() => assertDevSecretsEnv('dev')).not.toThrow();
  });

  test('rejects prd', () => {
    expect(() => assertDevSecretsEnv('prd')).toThrow(/secrets env `dev`/);
  });

  test('rejects empty', () => {
    expect(() => assertDevSecretsEnv('')).toThrow(/secrets env `dev`/);
  });
});

describe('assertNonProdDatabaseUrl', () => {
  test('allows distinct dev URL when prod reference differs', async () => {
    await expect(
      assertNonProdDatabaseUrl(DEV_URL, {}, { productionUrl: PROD_URL })
    ).resolves.toBeUndefined();
  });

  test('blocks URL equal to prod reference', async () => {
    await expect(
      assertNonProdDatabaseUrl(PROD_URL, {}, { productionUrl: PROD_URL })
    ).rejects.toThrow(/matches production/);
  });

  test('blocks loopback', async () => {
    await expect(
      assertNonProdDatabaseUrl(LOOPBACK_URL, {}, { productionUrl: PROD_URL })
    ).rejects.toThrow(/loopback/);
  });

  test('escape hatch skips loopback check', async () => {
    const prev = process.env['ALLOW_PRODUCTION_DATABASE_URL'];
    process.env['ALLOW_PRODUCTION_DATABASE_URL'] = '1';
    try {
      expect(productionDatabaseUrlTigerExceptionEnabled()).toBe(true);
      await expect(
        assertNonProdDatabaseUrl(LOOPBACK_URL, {}, { productionUrl: PROD_URL })
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
