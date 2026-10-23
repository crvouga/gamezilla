import { expect, test } from 'bun:test';
import {
  type BindValue,
  Database,
  type QueryOptions,
  type QueryRow,
  type Statement,
} from '@crvouga/mockingbird-service-postgres';
import { adaptMockingbirdPostgresAsPool } from '@pkgs/sql-client-postgres-server-ts/impl-mockingbird-postgres';

/** Calls the real engine; counts its documented parsing entry points. */
class CountedDatabase extends Database {
  parses = 0;

  override prepare(text: string): Statement {
    this.parses++;
    return super.prepare(text);
  }

  override query<T = QueryRow>(
    text: string,
    params?: readonly BindValue[],
    options?: QueryOptions
  ): T[] {
    this.parses++;
    return super.query<T>(text, params, options);
  }
}

// regression: mockingbird-adapter-reparses-sql
test('repeated SQL parses once and executes with each new binding', async () => {
  const db = new CountedDatabase();
  const pool = adaptMockingbirdPostgresAsPool(() => db);
  try {
    const text = 'SELECT $1::int4 AS value';
    expect((await pool.query(text, [41])).rows).toEqual([{ value: 41 }]);
    expect((await pool.query(text, [42])).rows).toEqual([{ value: 42 }]);
    expect(db.parses).toBe(1);
  } finally {
    db.close();
  }
});

test('a replacement database gets its own statements and current session state', async () => {
  const first = new CountedDatabase();
  const second = new CountedDatabase();
  let live = first;
  const pool = adaptMockingbirdPostgresAsPool(() => live);
  const text = "SELECT current_setting('application_name') AS name";
  try {
    first.exec("SET application_name TO 'first'");
    second.exec("SET application_name TO 'second'");
    expect((await pool.query(text)).rows).toEqual([{ name: 'first' }]);
    first.exec("SET application_name TO 'changed'");
    expect((await pool.query(text)).rows).toEqual([{ name: 'changed' }]);
    live = second;
    expect((await pool.query(text)).rows).toEqual([{ name: 'second' }]);
    expect(first.parses).toBe(1);
    expect(second.parses).toBe(1);
  } finally {
    first.close();
    second.close();
  }
});

test('statement reuse is bounded and an evicted template still executes', async () => {
  const db = new CountedDatabase();
  const pool = adaptMockingbirdPostgresAsPool(() => db);
  try {
    for (let value = 0; value <= 256; value++)
      expect((await pool.query(`SELECT ${value} AS value`)).rows).toEqual([
        { value },
      ]);
    expect(db.parses).toBe(257);
    expect((await pool.query('SELECT 256 AS value')).rows).toEqual([
      { value: 256 },
    ]);
    expect(db.parses).toBe(257);
    expect((await pool.query('SELECT 0 AS value')).rows).toEqual([
      { value: 0 },
    ]);
    expect(db.parses).toBe(258);
  } finally {
    db.close();
  }
});

test('a reused write executes again and a closed connection refuses cached reads', async () => {
  const db = new CountedDatabase();
  const pool = adaptMockingbirdPostgresAsPool(() => db);
  const read = "SELECT current_setting('application_name') AS name";
  const write = "SET application_name TO 'cached-write'";
  await pool.query(write);
  expect((await pool.query(read)).rows).toEqual([{ name: 'cached-write' }]);
  db.exec("SET application_name TO 'changed'");
  await pool.query(write);
  expect((await pool.query(read)).rows).toEqual([{ name: 'cached-write' }]);
  expect(db.parses).toBe(2);
  db.close();
  await expect(pool.query(read)).rejects.toThrow();
});
