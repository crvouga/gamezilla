import { describe, expect, test } from 'bun:test';
import { sanitizePostgresUrlForNodePg } from '@pkgs/sql-client-postgres-shared-ts/sanitize-url-for-node-pg';

describe('sanitizePostgresUrlForNodePg', () => {
  test('strips sslrootcert=system (the libpq sentinel that crashes pg)', () => {
    const raw =
      'postgres://u:p@host.us-east-1.pg.psdb.cloud:5432/postgres?sslmode=verify-full&sslrootcert=system';
    const out = sanitizePostgresUrlForNodePg(raw);
    expect(out).toContain('sslmode=verify-full');
    expect(out).not.toContain('sslrootcert');
  });

  test('keeps real sslrootcert file paths untouched', () => {
    const raw =
      'postgres://u:p@host:5432/db?sslmode=verify-full&sslrootcert=%2Ftmp%2Fca.pem';
    const out = sanitizePostgresUrlForNodePg(raw);
    expect(out).toContain('sslrootcert=%2Ftmp%2Fca.pem');
    expect(out).toContain('sslmode=verify-full');
  });

  test('strips sentinel for every TLS path key', () => {
    const raw =
      'postgres://u:p@host/db?sslmode=verify-full&sslrootcert=system&sslcert=system&sslkey=system&sslcrl=system&sslidentity=system';
    const out = sanitizePostgresUrlForNodePg(raw);
    expect(out).not.toContain('sslrootcert');
    expect(out).not.toContain('sslcert');
    expect(out).not.toContain('sslkey');
    expect(out).not.toContain('sslcrl');
    expect(out).not.toContain('sslidentity');
    expect(out).toContain('sslmode=verify-full');
  });

  test('normalizes legacy sslmode aliases to verify-full', () => {
    const raw = 'postgres://u:p@h/db?sslmode=require';
    const out = sanitizePostgresUrlForNodePg(raw);
    expect(out).toContain('sslmode=verify-full');
    expect(out).not.toContain('sslmode=require');
  });

  test('preserves the original string verbatim when unchanged', () => {
    const raw =
      'postgres://u:p@h/db?sslmode=verify-full&sslrootcert=%2Ftmp%2Fca.pem&application_name=infra';
    expect(sanitizePostgresUrlForNodePg(raw)).toBe(raw);
  });

  test('non-postgres input is returned unchanged', () => {
    const raw = 'mysql://localhost/db';
    expect(sanitizePostgresUrlForNodePg(raw)).toBe(raw);
  });

  test('garbage input is returned unchanged', () => {
    const raw = 'not-a-url';
    expect(sanitizePostgresUrlForNodePg(raw)).toBe(raw);
  });

  test('URL input is not mutated and serializes consistently', () => {
    const u = new URL(
      'postgres://u:p@host/db?sslmode=verify-full&sslrootcert=system'
    );
    const copyHref = u.href;
    const out = sanitizePostgresUrlForNodePg(u);
    expect(u.href).toBe(copyHref);
    expect(out).not.toContain('sslrootcert');
    expect(out).toContain('sslmode=verify-full');
  });

  test('postgresql:// scheme is also handled', () => {
    const raw =
      'postgresql://u:p@host:5432/db?sslmode=verify-full&sslrootcert=system';
    const out = sanitizePostgresUrlForNodePg(raw);
    expect(out).not.toContain('sslrootcert');
    expect(out.startsWith('postgresql://')).toBe(true);
  });
});
