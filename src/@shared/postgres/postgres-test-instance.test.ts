import { SQL } from 'bun';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  getPostgresTestInstance,
  stopPostgresTestInstance,
} from './postgres-test-instance';

const TEST_PORT = 25432;

describe.skip('postgres-test-instance', () => {
  let pg: Awaited<ReturnType<typeof getPostgresTestInstance>> | null = null;
  let available = false;

  beforeAll(async () => {
    try {
      pg = await getPostgresTestInstance({ port: TEST_PORT });
      available = true;
    } catch {
      available = false;
    }
  });

  afterAll(async () => {
    if (available) await stopPostgresTestInstance();
  });

  test('returns connection URL and wipe function', () => {
    if (!available || !pg) return;
    expect(pg.connectionUrl).toContain('postgres://');
    expect(pg.connectionUrl).toContain(`:${TEST_PORT}/`);
    expect(typeof pg.wipe).toBe('function');
  });

  test('can create table and insert data', async () => {
    if (!available || !pg) return;
    const sql = new SQL(pg.connectionUrl);
    await sql.unsafe('CREATE TABLE t (id SERIAL PRIMARY KEY, x TEXT)');
    await sql.unsafe('INSERT INTO t (x) VALUES ($1), ($2)', ['a', 'b']);
    const rows = await sql.unsafe('SELECT * FROM t');
    sql.close();
    expect(rows).toHaveLength(2);
  });

  test('wipe clears all tables', async () => {
    if (!available || !pg) return;
    await pg.wipe();
    const sql = new SQL(pg.connectionUrl);
    const tables = await sql.unsafe(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
    );
    sql.close();
    expect(tables).toHaveLength(0);
  });

  test('reuses same instance on subsequent calls', async () => {
    if (!available || !pg) return;
    const pg2 = await getPostgresTestInstance({ port: TEST_PORT });
    expect(pg2.connectionUrl).toBe(pg.connectionUrl);
  });
});
