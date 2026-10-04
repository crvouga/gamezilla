import { describe, expect, test } from 'bun:test';
import { sanitizePostgresUrlForBunSql } from '@pkgs/sql-client-postgres-shared/sanitize-url-for-bun-sql';

describe('sanitizePostgresUrlForBunSql', () => {
  test('removes sslrootcert and related libpq TLS file params', () => {
    const raw =
      'postgres://u:p@host.example:5432/db?sslmode=require&sslrootcert=%2Ftmp%2Fca.pem&application_name=infra';
    const out = sanitizePostgresUrlForBunSql(raw);
    expect(out).toContain('sslmode=require');
    expect(out).toContain('application_name=infra');
    expect(out).not.toContain('sslrootcert');
  });

  test('returns original string when no TLS file params', () => {
    const raw = 'postgres://u:p@h/db?sslmode=require';
    expect(sanitizePostgresUrlForBunSql(raw)).toBe(raw);
  });

  test('non-postgres string is returned unchanged', () => {
    const raw = 'mysql://localhost';
    expect(sanitizePostgresUrlForBunSql(raw)).toBe(raw);
  });

  test('URL input is not mutated and serializes like string path', () => {
    const u = new URL(
      'postgres://u:p@host/db?sslrootcert=/x.pem&sslcert=/c.pem'
    );
    const copyHref = u.href;
    const out = sanitizePostgresUrlForBunSql(u);
    expect(u.href).toBe(copyHref);
    expect(out).not.toContain('sslrootcert');
    expect(out).not.toContain('sslcert');
  });
});
