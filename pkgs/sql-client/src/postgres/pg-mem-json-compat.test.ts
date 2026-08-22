/**
 * Golden matrix for pg-mem after {@link installPgMemSqliteCompat}
 * (applied by {@link createPgMemSqlClient}).
 */

import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';
import { createPgMemSqlClient } from './impl-pg-mem';
import { installPgMemSqliteCompat } from './pg-mem-sqlite-compat';

const SAMPLE = '{"a":2,"c":[4,5,{"f":7}],"s":"xyz","n":null}';

describe('pg-mem sqlite JSON1 compat', () => {
  test('json_extract / type / valid / array_length', async () => {
    const { sqlClient, mem } = createPgMemSqlClient();
    try {
      const extract = await sqlClient.query(
        sql<{ v: string | null }>`
          SELECT json_extract(${SAMPLE}, ${'$.c[2].f'}) AS v`
      );
      expect(String(extract[0]?.v)).toBe('7');

      const missing = await sqlClient.query(
        sql<{ v: string | null }>`
          SELECT json_extract(${SAMPLE}, ${'$.missing'}) AS v`
      );
      expect(missing[0]?.v ?? null).toBeNull();

      const atom = await sqlClient.query(
        sql<{ v: string | null }>`
          SELECT json_extract(${SAMPLE}, ${'$.s'}) AS v`
      );
      expect(atom[0]?.v).toBe('xyz');

      const len = await sqlClient.query(
        sql<{ v: number | null }>`
          SELECT json_array_length(${SAMPLE}, ${'$.c'}) AS v`
      );
      expect(Number(len[0]?.v)).toBe(3);

      const ok = await sqlClient.query(
        sql<{ v: boolean }>`SELECT json_valid(${'{"a":1}'}) AS v`
      );
      const bad = await sqlClient.query(
        sql<{ v: boolean }>`SELECT json_valid(${'{'}) AS v`
      );
      expect(Boolean(ok[0]?.v)).toBe(true);
      expect(Boolean(bad[0]?.v)).toBe(false);

      const typ = await sqlClient.query(
        sql<{ v: string | null }>`
          SELECT json_type(${SAMPLE}, ${'$.c'}) AS v`
      );
      expect(typ[0]?.v).toBe('array');

      // Idempotent re-install on the same mem.
      installPgMemSqliteCompat({ mem });
      const again = await sqlClient.query(
        sql<{ v: string | null }>`
          SELECT json_extract(${'{"k":9}'}, ${'$.k'}) AS v`
      );
      expect(again[0]?.v).toBe('9');
    } finally {
      await sqlClient.disconnect();
    }
  });

  test('json_set / insert / replace / remove / patch / quote', async () => {
    const { sqlClient } = createPgMemSqlClient();
    try {
      const setRows = await sqlClient.query(
        sql<{ v: string | null }>`
          SELECT json_set(${'{"a":1}'}, ${'$.b'}, ${'2'}) AS v`
      );
      expect(JSON.parse(String(setRows[0]?.v))).toEqual({ a: 1, b: 2 });

      const insertRows = await sqlClient.query(
        sql<{ v: string | null }>`
          SELECT json_insert(${'{"a":1}'}, ${'$.a'}, ${'9'}) AS v`
      );
      expect(JSON.parse(String(insertRows[0]?.v))).toEqual({ a: 1 });

      const replaceRows = await sqlClient.query(
        sql<{ v: string | null }>`
          SELECT json_replace(${'{"a":1}'}, ${'$.a'}, ${'9'}) AS v`
      );
      expect(JSON.parse(String(replaceRows[0]?.v))).toEqual({ a: 9 });

      const removeRows = await sqlClient.query(
        sql<{ v: string | null }>`
          SELECT json_remove(${'{"a":1,"b":2}'}, ${'$.a'}) AS v`
      );
      expect(JSON.parse(String(removeRows[0]?.v))).toEqual({ b: 2 });

      const patchRows = await sqlClient.query(
        sql<{ v: string | null }>`
          SELECT json_patch(${'{"a":1}'}, ${'{"b":2}'}) AS v`
      );
      expect(JSON.parse(String(patchRows[0]?.v))).toEqual({ a: 1, b: 2 });

      const quoteRows = await sqlClient.query(
        sql<{ v: string | null }>`SELECT json_quote(${'hi'}) AS v`
      );
      expect(quoteRows[0]?.v).toBe('"hi"');
    } finally {
      await sqlClient.disconnect();
    }
  });
});
