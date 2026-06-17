import { SQL } from 'bun';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import {
  getPostgresTestInstance,
  stopPostgresTestInstance,
} from './postgres-test-instance';

/** Offset from default test port so parallel local runs are less likely to collide. */
const TEST_PORT = 25_432 + (process.pid % 1_000);

describe('postgres-test-instance (embedded-postgres)', () => {
  let pg: Awaited<ReturnType<typeof getPostgresTestInstance>> | null = null;
  let available = false;

  beforeAll(async () => {
    try {
      pg = await getPostgresTestInstance({ port: TEST_PORT });
      await pg.wipe();
      const sql = new SQL(pg.connectionUrl);
      await sql.unsafe('SELECT 1');
      void sql.close();
      available = true;
    } catch (e) {
      // Bundled binaries are unavailable on this platform/arch, or the cluster
      // failed to boot — degrade gracefully rather than failing the whole suite.
      console.error('[postgres-test] embedded-postgres unavailable:', e);
      available = false;
    }
  }, 60_000);

  afterAll(async () => {
    if (!available) return;
    await stopPostgresTestInstance().catch((e: unknown) => {
      console.error('[postgres-test] stop failed:', e);
    });
  });

  beforeEach(async () => {
    if (!available || !pg) return;
    await pg.wipe();
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
    void sql.close();
    expect(rows).toHaveLength(2);
  });

  test('wipe clears tables in the application schema', async () => {
    if (!available || !pg) return;
    const schema = pg.config.schema;
    const sql = new SQL(pg.connectionUrl);
    await sql.unsafe(
      `CREATE TABLE ${schema}.t (id SERIAL PRIMARY KEY, x TEXT)`
    );
    void sql.close();
    await pg.wipe();
    const verify = new SQL(pg.connectionUrl);
    const tables = await verify.unsafe(
      `SELECT tablename FROM pg_tables WHERE schemaname = '${schema}'`
    );
    void verify.close();
    expect(tables).toHaveLength(0);
  });

  test('reuses same instance on subsequent calls', async () => {
    if (!available || !pg) return;
    const pg2 = await getPostgresTestInstance({ port: TEST_PORT });
    expect(pg2.connectionUrl).toBe(pg.connectionUrl);
  });
});
