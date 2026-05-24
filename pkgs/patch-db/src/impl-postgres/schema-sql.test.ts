import { expect, test } from 'bun:test';
import { MIGRATIONS } from './sql-constants';

test('postgres migrations: patches table + its three btrees', () => {
  expect(MIGRATIONS).toContain('CREATE TABLE IF NOT EXISTS patches');
  expect(MIGRATIONS).toContain('idx_patches_entity');
  expect(MIGRATIONS).toContain('idx_patches_roots');
  expect(MIGRATIONS).toContain('idx_patches_parent');
  expect(MIGRATIONS).not.toContain('REFERENCES patches');
});

test('postgres migrations: no `snapshots` parent / partition / view (reconciler owns those)', () => {
  // The base DDL must not create a `snapshots` table or view: per-entity
  // standalone tables + the `UNION ALL` view are 100% reconciler-managed
  // (see `pg-reconcile.ts`). Mentioning `snapshots` here would defeat the
  // legacy-detection step in `migrate.ts` (it would re-create a parent
  // right after we just dropped one).
  expect(MIGRATIONS).not.toMatch(/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?snapshots\b/i);
  expect(MIGRATIONS).not.toMatch(/CREATE\s+VIEW\s+(IF\s+NOT\s+EXISTS\s+)?snapshots\b/i);
  expect(MIGRATIONS).not.toContain('PARTITION OF snapshots');
  expect(MIGRATIONS).not.toContain('PARTITION BY LIST');
});

test('postgres migrations: application-agnostic (no domain entity types)', () => {
  // The library must not reference any application-specific entity types or
  // attribute keys. Apps own their own snapshot expression indexes via their
  // own migrations on top of the patch-db base schema.
  expect(MIGRATIONS).not.toMatch(/entity_type\s*=\s*'/i);
  expect(MIGRATIONS).not.toContain("attributes->>'");
  expect(MIGRATIONS).not.toContain('attributes ?');
});
