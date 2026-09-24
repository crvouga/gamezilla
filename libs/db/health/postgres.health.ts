// @io-wall-ok — live health probe (process root against the env's Postgres).
import { describe, expect, test } from 'bun:test';
import { wallTimers } from '@pkgs/clock';
import { pingPostgres } from '@pkgs/sql-client-postgres/ping';

describe('postgres', () => {
  test('DATABASE_URL accepts a read-only query', async () => {
    const url = process.env['DATABASE_URL']?.trim() ?? '';
    expect(url, 'DATABASE_URL missing from secrets env').not.toBe('');
    await pingPostgres(url, wallTimers);
  });
});
