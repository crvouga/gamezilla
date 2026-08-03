import { describe, expect, test } from 'bun:test';

import { parsePgDumpVersion, PG_DUMP_REQUIRED_MAJOR } from './pg-dump';

describe('parsePgDumpVersion', () => {
  test('parses Homebrew-style --version output', () => {
    expect(parsePgDumpVersion('pg_dump (PostgreSQL) 18.4')).toBe('18.4');
  });

  test('parses patchless major.minor', () => {
    expect(parsePgDumpVersion('pg_dump (PostgreSQL) 18.0')).toBe('18.0');
  });

  test('returns null for unrelated text', () => {
    expect(parsePgDumpVersion('not a version string')).toBeNull();
  });
});

describe('PG_DUMP_REQUIRED_MAJOR', () => {
  test('pins hosted Postgres major', () => {
    expect(PG_DUMP_REQUIRED_MAJOR).toBe(18);
  });
});
