import { describe, expect, test } from 'bun:test';
import { createPostgresDbScope, quotePgIdent } from './schema';
import {
  postgresRejectsStartupSearchPathOption,
  withPostgresSearchPathOption,
} from './session-schema';

describe('postgres-schema', () => {
  test('scope carries the injected schema name', () => {
    const scope = createPostgresDbScope('my_app');
    expect(scope.schema).toBe('my_app');
  });

  test('quotePgIdent double-quotes and escapes embedded quotes', () => {
    expect(quotePgIdent('gamezilla')).toBe('"gamezilla"');
    expect(quotePgIdent('we"ird')).toBe('"we""ird"');
  });
});

describe('withPostgresSearchPathOption', () => {
  test('pins search_path via the libpq startup options parameter', () => {
    const out = withPostgresSearchPathOption(
      'postgres://u:p@host:5432/db?sslmode=disable',
      createPostgresDbScope('my_app')
    );
    const url = new URL(out);
    expect(url.searchParams.get('options')).toBe('-c search_path=my_app');
    expect(url.searchParams.get('sslmode')).toBe('disable');
  });

  test('returns the input unchanged when it is not a URL', () => {
    const out = withPostgresSearchPathOption(
      'not a url',
      createPostgresDbScope('my_app')
    );
    expect(out).toBe('not a url');
  });

  test('skips startup options on Neon pooler hosts', () => {
    const input =
      'postgres://u:p@ep-cool-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require';
    expect(postgresRejectsStartupSearchPathOption(input)).toBe(true);
    const out = withPostgresSearchPathOption(
      input,
      createPostgresDbScope('my_app')
    );
    expect(out).toBe(input);
    expect(new URL(out).searchParams.get('options')).toBeNull();
  });
});
