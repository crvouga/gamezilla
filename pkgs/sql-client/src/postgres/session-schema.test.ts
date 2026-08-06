import { describe, expect, test } from 'bun:test';

import { createPostgresDbScope } from './schema';
import { pinAndVerifyPgSessionSchema } from './session-schema';

type Row = Record<string, unknown>;

describe('pinAndVerifyPgSessionSchema', () => {
  test('pooler URLs pin + verify inside one BEGIN/SET LOCAL/COMMIT', async () => {
    const calls: string[] = [];
    const queryable = {
      query: async <R extends Row>(text: string) => {
        calls.push(text);
        if (text.startsWith('SELECT current_schema')) {
          return {
            rows: [{ current_schema: 'app_schema' }] as unknown as R[],
          };
        }
        return { rows: [] as R[] };
      },
    };
    await pinAndVerifyPgSessionSchema(
      queryable,
      createPostgresDbScope('app_schema'),
      'postgres://u:p@ep-x-pooler.neon.tech/db'
    );
    expect(calls[0]).toBe('BEGIN');
    expect(calls[1]).toContain('SET LOCAL search_path TO');
    expect(calls[2]).toContain('current_schema');
    expect(calls[3]).toBe('COMMIT');
  });

  test('non-pooler URLs use session SET then verify', async () => {
    const calls: string[] = [];
    const queryable = {
      query: async <R extends Row>(text: string) => {
        calls.push(text);
        if (text.startsWith('SELECT current_schema')) {
          return {
            rows: [{ current_schema: 'app_schema' }] as unknown as R[],
          };
        }
        return { rows: [] as R[] };
      },
    };
    await pinAndVerifyPgSessionSchema(
      queryable,
      createPostgresDbScope('app_schema'),
      'postgres://u:p@db.example.com/db'
    );
    expect(calls[0]).toContain('SET search_path TO');
    expect(calls[0]).not.toContain('SET LOCAL');
    expect(calls[1]).toContain('current_schema');
    expect(calls.some((c) => c === 'BEGIN')).toBe(false);
  });
});
